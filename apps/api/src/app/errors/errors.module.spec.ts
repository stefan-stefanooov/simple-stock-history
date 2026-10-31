import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Query,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import {
  PROBLEM_JSON_MEDIA_TYPE,
  ProblemDetailsSchema,
} from '@simple-stock-history/shared';
import { createZodDto } from 'nestjs-zod';
import { PARAMS_PROVIDER_TOKEN, type Params } from 'nestjs-pino';
import { Writable } from 'node:stream';
import request, { type Response } from 'supertest';
import { z } from 'zod';
import { AppModule } from '../app.module';
import { loadConfig } from '../config/app-config';
import { APP_CONFIG } from '../config/config.module';
import { configureApp } from '../configure-app';
import { BestTradeQueryDto } from '../dtos';
import { createPinoHttpOptions } from '../logging/pino-http-options';
import {
  INVALID_REQUEST_DETAIL,
  InvalidRequestException,
} from './invalid-request.exception';
import { UNEXPECTED_ERROR_DETAIL } from './problem-details.filter';

type LogLine = Record<string, unknown>;

const logLines: LogLine[] = [];
const logStream = new Writable({
  write(chunk, _encoding, callback) {
    logLines.push(JSON.parse(String(chunk)));
    callback();
  },
});

/** Waits for a log line matching `expected`; logs are written asynchronously. */
async function expectLogged(expected: LogLine): Promise<void> {
  const deadline = Date.now() + 2000;
  while (!logLines.some((line) => matches(line, expected))) {
    if (Date.now() > deadline) {
      expect(logLines).toContainEqual(expect.objectContaining(expected));
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function matches(line: LogLine, expected: LogLine): boolean {
  try {
    expect(line).toEqual(expect.objectContaining(expected));
    return true;
  } catch {
    return false;
  }
}

const DIGITS_ONLY_MESSAGE =
  'Must be Unix epoch seconds written with digits only: no sign, spaces, decimal point or exponent';

/** A schema that blows up instead of rejecting its input. */
class BrokenSchemaDto extends createZodDto(
  z.object({
    from: z.string().transform((): string => {
      throw new Error('schema bug');
    }),
  }),
) {}

/** Routes that fail in each way the API can fail. */
@Controller('test')
class FailingController {
  @Get('time-slice')
  @Header('Cache-Control', 'public, max-age=86400')
  timeSlice(@Query() timeSlice: BestTradeQueryDto) {
    return timeSlice;
  }

  @Get('outside-data-period')
  outsideDataPeriod() {
    throw new InvalidRequestException([
      { path: ['from'], message: 'Must lie within the Data Period' },
    ]);
  }

  @Get('too-short')
  tooShort() {
    throw new UnprocessableEntityException(
      'The Time Slice must be at least 2 seconds long',
    );
  }

  @Get('plain-not-found')
  plainNotFound() {
    throw new NotFoundException();
  }

  @Get('not-ready')
  notReady() {
    throw new ServiceUnavailableException('The Price History is loading');
  }

  @Get('crash')
  crash() {
    throw new Error('secret internals at /srv/app/price-history.ts');
  }

  @Get('throw-string')
  throwString() {
    throw 'not an Error';
  }

  @Get('unvalidated')
  unvalidated(@Query('from') from: string) {
    return { from };
  }

  @Get('broken-schema')
  brokenSchema(@Query() query: BrokenSchemaDto) {
    return query;
  }
}

/** Checks the parts every problem+json response shares, and returns its body. */
function expectProblem(response: Response, status: number) {
  expect(response.status).toBe(status);
  expect(response.headers['content-type']).toBe(
    `${PROBLEM_JSON_MEDIA_TYPE}; charset=utf-8`,
  );
  expect(response.headers['cache-control']).toBe('no-store');
  const body = JSON.parse(response.text);
  // Strict: fails on any member the shared contract does not define.
  expect(ProblemDetailsSchema.strict().parse(body)).toEqual(body);
  expect(body).toMatchObject({ type: 'about:blank', status });
  return body;
}

describe('ErrorsModule', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const config = loadConfig({ NODE_ENV: 'production', LOG_LEVEL: 'info' });
    const params: Params = {
      pinoHttp: [createPinoHttpOptions(config), logStream],
    };
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [FailingController],
    })
      .overrideProvider(APP_CONFIG)
      .useValue(config)
      .overrideProvider(PARAMS_PROVIDER_TOKEN)
      .useValue(params)
      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({
      bufferLogs: true,
    });
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const get = (url: string) => request(app.getHttpServer()).get(url);

  describe('request validation', () => {
    it('hands a valid Time Slice to the handler decoded to numbers', async () => {
      const response = await get(
        '/api/test/time-slice?from=1761955200&to=1762041599',
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ from: 1761955200, to: 1762041599 });
    });

    it('answers a malformed and a missing parameter with 400 and both issues', async () => {
      const url = '/api/test/time-slice?from=1761955200.5';
      const response = await get(url);

      expect(expectProblem(response, 400)).toEqual({
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        detail: INVALID_REQUEST_DETAIL,
        instance: url,
        issues: [
          { path: ['from'], message: DIGITS_ONLY_MESSAGE },
          { path: ['to'], message: 'Required' },
        ],
      });
    });

    it('answers a repeated parameter with 400', async () => {
      const response = await get(
        '/api/test/time-slice?from=1761955200&from=1761955201&to=1762041599',
      );

      expect(expectProblem(response, 400).issues).toEqual([
        { path: ['from'], message: 'Must be given only once' },
      ]);
    });

    it("does not let a 400 be cached for as long as the route's answers", async () => {
      const response = await get('/api/test/time-slice');

      expectProblem(response, 400);
    });

    it('answers an InvalidRequestException with 400 and its issues', async () => {
      const response = await get('/api/test/outside-data-period');

      expect(expectProblem(response, 400)).toMatchObject({
        detail: INVALID_REQUEST_DETAIL,
        issues: [
          { path: ['from'], message: 'Must lie within the Data Period' },
        ],
      });
    });

    it('rejects a parameter that is not typed with a DTO, so none goes unchecked', async () => {
      const response = await get('/api/test/unvalidated?from=1');

      expectProblem(response, 500);
    });

    it('treats a schema that throws as a bug, not as bad input', async () => {
      const response = await get('/api/test/broken-schema?from=1');

      expect(expectProblem(response, 500).detail).toBe(UNEXPECTED_ERROR_DETAIL);
    });
  });

  describe('unknown routes', () => {
    it.each(['/api/no-such-route', '/no-such-route'])(
      'answers %s with 404',
      async (url) => {
        const response = await get(url);

        expect(expectProblem(response, 404)).toEqual({
          type: 'about:blank',
          title: 'Not Found',
          status: 404,
          detail: `Cannot GET ${url}`,
          instance: url,
        });
      },
    );

    it('leaves out a detail that only repeats the title', async () => {
      const response = await get('/api/test/plain-not-found');

      expect(expectProblem(response, 404).detail).toBeUndefined();
    });
  });

  describe('other HTTP errors', () => {
    it('answers with the status and message an HttpException was thrown with', async () => {
      const response = await get('/api/test/too-short');

      expect(expectProblem(response, 422)).toMatchObject({
        title: 'Unprocessable Entity',
        detail: 'The Time Slice must be at least 2 seconds long',
      });
    });

    it('answers a deliberate 503 with its message', async () => {
      const response = await get('/api/test/not-ready');

      expect(expectProblem(response, 503)).toMatchObject({
        title: 'Service Unavailable',
        detail: 'The Price History is loading',
      });
    });

    it('answers a malformed JSON body with 400', async () => {
      const response = await get('/api/test/too-short')
        .set('Content-Type', 'application/json')
        .send('{"from":');

      expectProblem(response, 400);
    });

    it('answers a body over the size limit with 413', async () => {
      const response = await get('/api/test/too-short')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ padding: 'x'.repeat(200_000) }));

      expect(expectProblem(response, 413)).toMatchObject({
        title: 'Payload Too Large',
        detail: 'request entity too large',
      });
    });
  });

  describe('unexpected errors', () => {
    it('answers with 500 and nothing about the error itself', async () => {
      const response = await get('/api/test/crash');

      expect(expectProblem(response, 500)).toEqual({
        type: 'about:blank',
        title: 'Internal Server Error',
        status: 500,
        detail: UNEXPECTED_ERROR_DETAIL,
        instance: '/api/test/crash',
      });
      expect(response.text).not.toMatch(/secret|\.ts|at /);
    });

    it('logs the error with its stack', async () => {
      await get('/api/test/crash');

      await expectLogged({
        level: 'error',
        context: 'ProblemDetailsFilter',
        msg: 'Answered 500: Error: secret internals at /srv/app/price-history.ts',
        err: expect.objectContaining({
          type: 'Error',
          message: 'secret internals at /srv/app/price-history.ts',
          stack: expect.stringContaining('FailingController.crash'),
        }),
      });
    });

    it('answers a thrown non-Error with 500 and logs it', async () => {
      const response = await get('/api/test/throw-string');

      expectProblem(response, 500);
      await expectLogged({ level: 'error', msg: 'Answered 500: not an Error' });
    });

    it('does not log a deliberate 503 as an unexpected error', async () => {
      await get('/api/test/not-ready');
      // The request's own log line comes after anything the filter logs.
      await expectLogged({
        req: expect.objectContaining({ url: '/api/test/not-ready' }),
      });

      expect(logLines).not.toContainEqual(
        expect.objectContaining({
          msg: expect.stringContaining('Answered 503'),
        }),
      );
    });
  });
});
