import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ApiOkResponse, type OpenAPIObject } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import {
  BestTradeResponseSchema,
  PROBLEM_JSON_MEDIA_TYPE,
  ProblemDetailsSchema,
} from '@simple-stock-history/shared';
import { join } from 'node:path';
import request from 'supertest';
import type { PriceHistoryFixture } from '../../testing/price-history-fixture.interface';
import { writePriceHistoryFixture } from '../../testing/price-history-fixture';
import { AppModule } from '../app.module';
import { loadConfig } from '../config/app-config';
import { APP_CONFIG } from '../config/config.module';
import { configureApp } from '../configure-app';
import { BestTradeQueryDto, BestTradeResponseDto } from '../dtos';
import { ApiProblemResponse } from './api-problem-response.decorator';

const PROBLEM_REF = { $ref: '#/components/schemas/ProblemDetailsDto' };
const PROBLEM_CONTENT = { [PROBLEM_JSON_MEDIA_TYPE]: { schema: PROBLEM_REF } };

/** The real Price History, written by `price-history-generator:generate`, which `api:test` depends on. */
const REAL_PRICE_HISTORY_PATH = join(
  __dirname,
  '../../../../../data/acme-2025-11.bin',
);

const BEST_TRADE_PATH = '/api/v1/trades/best';

/** The named examples of one response's body in an OpenAPI document. */
type Examples = Record<string, { summary: string; value: unknown }>;

function examplesOf(
  document: OpenAPIObject,
  status: string,
  mediaType: string,
): Examples {
  const response = document.paths[BEST_TRADE_PATH]?.get?.responses[status] as
    { content?: Record<string, { examples?: Examples }> } | undefined;
  return response?.content?.[mediaType]?.examples ?? {};
}

/** Stand-in routes that exercise how setupSwagger documents any route. */
@Controller('test/trades')
class DocumentedController {
  @Get('best')
  @ApiOkResponse({ type: BestTradeResponseDto.Output })
  @ApiProblemResponse(422, 'The Time Slice is shorter than 2 seconds')
  best(@Query() timeSlice: BestTradeQueryDto) {
    throw new UnprocessableEntityException(timeSlice);
  }

  @Get('own-400')
  @ApiProblemResponse(400, 'The Time Slice lies outside the Data Period')
  own400(@Query() timeSlice: BestTradeQueryDto) {
    throw new BadRequestException(timeSlice);
  }

  @Get('no-input')
  noInput() {
    return {};
  }
}

let priceHistory: PriceHistoryFixture;

beforeAll(async () => {
  priceHistory = await writePriceHistoryFixture();
});

afterAll(async () => {
  await priceHistory.remove();
});

async function createApp(
  env: Record<string, string>,
  priceHistoryPath = priceHistory.paths.priceHistory,
): Promise<NestExpressApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    controllers: [DocumentedController],
  })
    .overrideProvider(APP_CONFIG)
    .useValue(
      loadConfig({
        NODE_ENV: 'test',
        PRICE_HISTORY_PATH: priceHistoryPath,
        ...env,
      }),
    )
    .compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    bufferLogs: true,
  });
  configureApp(app);
  await app.init();
  return app;
}

describe('Swagger docs, SWAGGER_ENABLED=true', () => {
  let app: NestExpressApplication;
  let document: OpenAPIObject;

  beforeAll(async () => {
    app = await createApp({ SWAGGER_ENABLED: 'true' });
    const response = await request(app.getHttpServer()).get(
      '/api/docs/openapi.json',
    );
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    document = response.body;
  });

  afterAll(async () => {
    await app.close();
  });

  const operation = (path: string) => document.paths[path]?.get;

  it('serves Swagger UI at /api/docs', async () => {
    const page = await request(app.getHttpServer()).get('/api/docs');
    const bundle = await request(app.getHttpServer()).get(
      '/api/docs/swagger-ui-bundle.js',
    );
    const init = await request(app.getHttpServer()).get(
      '/api/docs/swagger-ui-init.js',
    );

    expect(page.status).toBe(200);
    expect(page.headers['content-type']).toMatch(/^text\/html/);
    expect(page.text).toContain('swagger-ui-bundle.js');
    expect(bundle.status).toBe(200);
    expect(init.status).toBe(200);
    expect(init.text).toContain('Simple Stock History API');
  });

  it('serves Swagger UI under the same Content-Security-Policy as the rest of the API', async () => {
    const docs = await request(app.getHttpServer()).get('/api/docs');
    const api = await request(app.getHttpServer()).get('/api/hello');

    expect(docs.headers['content-security-policy']).toBe(
      api.headers['content-security-policy'],
    );
    expect(docs.headers['content-security-policy']).toContain(
      "script-src 'self'",
    );
  });

  it('serves only the JSON document, not the default -json and -yaml URLs', async () => {
    for (const url of ['/api/docs-json', '/api/docs-yaml']) {
      const response = await request(app.getHttpServer()).get(url);
      expect(response.status).toBe(404);
    }
  });

  it('is an OpenAPI 3.1 document of the API', () => {
    expect(document).toMatchObject({
      openapi: '3.1.0',
      info: { title: 'Simple Stock History API', version: '1' },
    });
  });

  it('leaves out the Kubernetes probes', () => {
    expect(Object.keys(document.paths)).not.toContain('/healthz');
    expect(Object.keys(document.paths)).not.toContain('/readyz');
  });

  it('describes the Time Slice query parameters with the shared zod schema', () => {
    expect(operation('/api/test/trades/best')?.parameters).toEqual([
      expect.objectContaining({
        name: 'from',
        in: 'query',
        required: true,
        description:
          'First second of the Time Slice, Unix epoch seconds (UTC), digits only',
        schema: expect.objectContaining({
          type: 'string',
          pattern: '^[0-9]+$',
        }),
      }),
      expect.objectContaining({
        name: 'to',
        in: 'query',
        required: true,
        description:
          'Last second of the Time Slice, included, Unix epoch seconds (UTC), digits only',
      }),
    ]);
  });

  it('describes the Best Trade response with the shared zod schema', () => {
    expect(operation('/api/test/trades/best')?.responses['200']).toMatchObject({
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/BestTradeResponseDto_Output' },
        },
      },
    });
    const schema = document.components?.schemas?.[
      'BestTradeResponseDto_Output'
    ] as { properties: Record<string, unknown> };
    expect(Object.keys(schema.properties).sort()).toEqual(
      ['currency', 'from', 'to', 'trade'].sort(),
    );
  });

  it('documents GET /api/v1/period with the shared zod schema', () => {
    const period = operation('/api/v1/period');

    expect(period?.summary).toBe(
      'The Share and the Data Period its Price History covers',
    );
    expect(period?.parameters ?? []).toEqual([]);
    expect(period?.responses['200']).toMatchObject({
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/PeriodResponseDto_Output' },
        },
      },
    });
    expect(period?.responses['400']).toBeUndefined();
    expect(period?.responses['500']).toMatchObject({
      content: PROBLEM_CONTENT,
    });

    const schema = document.components?.schemas?.[
      'PeriodResponseDto_Output'
    ] as { properties: Record<string, unknown>; required: string[] };
    expect(schema.properties).toMatchObject({
      share: { const: 'ACME' },
      from: { type: 'integer', description: 'First second of the Data Period' },
      to: {
        type: 'integer',
        description: 'Last second of the Data Period, included',
      },
      currency: { const: 'USD' },
    });
    expect(schema.required.sort()).toEqual(
      ['currency', 'from', 'share', 'to'].sort(),
    );
  });

  it('documents GET /api/v1/trades/best with the shared zod schemas', () => {
    const best = operation(BEST_TRADE_PATH);

    expect(best?.summary).toBe('The Best Trade in a Time Slice');
    expect(best?.description).toContain('No Profitable Trade');
    expect(best?.parameters).toEqual([
      expect.objectContaining({
        name: 'from',
        in: 'query',
        required: true,
        schema: expect.objectContaining({ pattern: '^[0-9]+$' }),
      }),
      expect.objectContaining({ name: 'to', in: 'query', required: true }),
    ]);
    expect(best?.responses['200']).toMatchObject({
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/BestTradeResponseDto_Output' },
        },
      },
    });
    expect(best?.responses['400']).toMatchObject({
      description: expect.stringContaining('outside the Data Period'),
      content: PROBLEM_CONTENT,
    });
    expect(best?.responses['422']).toMatchObject({
      description: expect.stringContaining('shorter than 2 seconds'),
      content: PROBLEM_CONTENT,
    });
    expect(best?.responses['500']).toMatchObject({ content: PROBLEM_CONTENT });
  });

  it('gives GET /api/v1/trades/best an example for each case, valid against the shared zod schemas', () => {
    const ok = Object.values(examplesOf(document, '200', 'application/json'));
    const badRequest = Object.values(
      examplesOf(document, '400', PROBLEM_JSON_MEDIA_TYPE),
    );
    const unprocessable = Object.values(
      examplesOf(document, '422', PROBLEM_JSON_MEDIA_TYPE),
    );

    const trades = ok.map(
      ({ value }) => BestTradeResponseSchema.parse(value).trade,
    );
    expect(trades).toContainEqual(
      expect.objectContaining({ profitCents: expect.any(Number) }),
    );
    expect(trades).toContainEqual(null);
    expect(badRequest.length).toBeGreaterThanOrEqual(3);
    for (const { value } of badRequest) {
      expect(ProblemDetailsSchema.parse(value).status).toBe(400);
    }
    expect(unprocessable).toHaveLength(1);
    for (const { value } of unprocessable) {
      expect(ProblemDetailsSchema.parse(value).status).toBe(422);
    }
  });

  it('describes the problem+json body with the shared zod schema', () => {
    const schema = document.components?.schemas?.['ProblemDetailsDto'] as {
      properties: Record<string, unknown>;
      required: string[];
    };

    expect(Object.keys(schema.properties).sort()).toEqual(
      Object.keys(ProblemDetailsSchema.shape).sort(),
    );
    expect(schema.required.sort()).toEqual(['status', 'title', 'type']);
  });

  it('documents a problem+json 500 on every operation', () => {
    const operations = Object.values(document.paths).flatMap((pathItem) =>
      pathItem.get ? [pathItem.get] : [],
    );

    expect(operations.length).toBeGreaterThan(0);
    for (const { responses } of operations) {
      expect(responses['500']).toMatchObject({ content: PROBLEM_CONTENT });
    }
  });

  it('documents a problem+json 400 on operations that take input', () => {
    expect(operation('/api/test/trades/best')?.responses['400']).toMatchObject({
      description: expect.stringContaining('issues'),
      content: PROBLEM_CONTENT,
    });
    expect(
      operation('/api/test/trades/no-input')?.responses['400'],
    ).toBeUndefined();
  });

  it("keeps a route's own description of its 400", () => {
    expect(
      operation('/api/test/trades/own-400')?.responses['400'],
    ).toMatchObject({
      description: 'The Time Slice lies outside the Data Period',
      content: PROBLEM_CONTENT,
    });
  });

  it('documents the errors a route declares with @ApiProblemResponse', () => {
    expect(operation('/api/test/trades/best')?.responses['422']).toMatchObject({
      description: 'The Time Slice is shorter than 2 seconds',
      content: PROBLEM_CONTENT,
    });
  });
});

describe('Swagger docs, SWAGGER_ENABLED=false', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createApp({ SWAGGER_ENABLED: 'false' });
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([
    '/api/docs',
    '/api/docs/openapi.json',
    '/api/docs/swagger-ui-init.js',
  ])('answers %s with 404', async (url) => {
    const response = await request(app.getHttpServer()).get(url);

    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toMatch(
      /^application\/problem\+json/,
    );
  });

  it('still serves the API', async () => {
    const response = await request(app.getHttpServer()).get('/api/hello');

    expect(response.status).toBe(200);
  });
});

describe('Swagger examples of GET /api/v1/trades/best', () => {
  let app: NestExpressApplication;
  let document: OpenAPIObject;

  beforeAll(async () => {
    app = await createApp({ SWAGGER_ENABLED: 'true' }, REAL_PRICE_HISTORY_PATH);
    document = (
      await request(app.getHttpServer()).get('/api/docs/openapi.json')
    ).body;
  });

  afterAll(async () => {
    await app.close();
  });

  const exampleCases = (status: string, mediaType: string) =>
    Object.entries(examplesOf(document, status, mediaType));

  it('are what the API answers for the real Price History: 200', async () => {
    const examples = exampleCases('200', 'application/json');

    expect(examples.length).toBeGreaterThan(0);
    for (const [, { value }] of examples) {
      const { from, to } = value as { from: number; to: number };
      const response = await request(app.getHttpServer()).get(
        `${BEST_TRADE_PATH}?from=${from}&to=${to}`,
      );
      expect(response.status).toBe(200);
      expect(response.body).toEqual(value);
    }
  });

  it.each(['400', '422'])(
    'are what the API answers for the real Price History: %s',
    async (status) => {
      const examples = exampleCases(status, PROBLEM_JSON_MEDIA_TYPE);

      expect(examples.length).toBeGreaterThan(0);
      for (const [, { value }] of examples) {
        const { instance } = value as { instance: string };
        const response = await request(app.getHttpServer()).get(instance);
        expect(response.status).toBe(Number(status));
        expect(response.body).toEqual(value);
      }
    },
  );
});
