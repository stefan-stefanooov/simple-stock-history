import { Controller, Get, type Type } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { PARAMS_PROVIDER_TOKEN, type Params } from 'nestjs-pino';
import { Writable } from 'node:stream';
import request from 'supertest';
import { AppModule } from './app.module';
import { loadConfig } from './config/app-config';
import { APP_CONFIG } from './config/config.module';
import { configureApp } from './configure-app';
import { createPinoHttpOptions } from './logging/pino-http-options';

type LogLine = Record<string, unknown>;

// nestjs-pino builds one pino instance per process, so every app in this file
// logs to the same captured stream.
const logLines: LogLine[] = [];
const logStream = new Writable({
  write(chunk, _encoding, callback) {
    logLines.push(JSON.parse(String(chunk)));
    callback();
  },
});

async function createApp(
  controllers: Type[] = [],
): Promise<NestExpressApplication> {
  const config = loadConfig({ NODE_ENV: 'production', LOG_LEVEL: 'info' });
  const params: Params = {
    pinoHttp: [createPinoHttpOptions(config), logStream],
  };
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    controllers,
  })
    .overrideProvider(APP_CONFIG)
    .useValue(config)
    .overrideProvider(PARAMS_PROVIDER_TOKEN)
    .useValue(params)
    .compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({
    bufferLogs: true,
  });
  configureApp(app);
  return app;
}

/** Polls until `read` returns something truthy; logs and shutdown are asynchronous. */
async function eventually<T>(read: () => T | undefined | false): Promise<T> {
  const deadline = Date.now() + 2000;
  for (;;) {
    const value = read();
    if (value) return value;
    if (Date.now() > deadline) throw new Error('Timed out waiting');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function requestLogFor(url: string): Promise<LogLine> {
  return eventually(() =>
    logLines.find(
      (line) =>
        line['msg'] === 'request completed' &&
        (line['req'] as LogLine | undefined)?.['url'] === url,
    ),
  );
}

describe('configureApp', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createApp();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('sets helmet security headers', async () => {
    const response = await request(app.getHttpServer()).get('/api');

    expect(response.headers).toMatchObject({
      'content-security-policy': expect.any(String),
      'strict-transport-security': expect.any(String),
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'SAMEORIGIN',
    });
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('logs each request as a JSON line with the client IP from X-Forwarded-For', async () => {
    await request(app.getHttpServer())
      .get('/api?from=1')
      .set('X-Forwarded-For', '203.0.113.7')
      .set('User-Agent', 'jest');

    expect(await requestLogFor('/api?from=1')).toMatchObject({
      level: 'info',
      time: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      req: {
        method: 'GET',
        url: '/api?from=1',
        remoteAddress: '203.0.113.7',
        userAgent: 'jest',
      },
      res: { statusCode: 200 },
      responseTime: expect.any(Number),
    });
  });

  it('takes the client IP from the address Traefik appended, not from addresses the client sent', async () => {
    await request(app.getHttpServer())
      .get('/api?from=2')
      .set('X-Forwarded-For', '198.51.100.1, 203.0.113.8');

    expect(await requestLogFor('/api?from=2')).toMatchObject({
      req: { remoteAddress: '203.0.113.8' },
    });
  });

  it('logs client errors at warn', async () => {
    await request(app.getHttpServer()).get('/api/no-such-route');

    expect(await requestLogFor('/api/no-such-route')).toMatchObject({
      level: 'warn',
      res: { statusCode: 404 },
    });
  });

  it("routes Nest's own logs through pino", () => {
    expect(logLines).toContainEqual(
      expect.objectContaining({
        level: 'info',
        context: 'NestApplication',
        msg: 'Nest application successfully started',
      }),
    );
  });
});

function signal(): { fired: Promise<void>; fire: () => void } {
  let fire!: () => void;
  const fired = new Promise<void>((resolve) => (fire = resolve));
  return { fired, fire };
}

const slowRequestArrived = signal();
const releaseSlowRequest = signal();

/** Holds `GET /api/slow` open until the test releases it. */
@Controller('slow')
class SlowController {
  @Get()
  async respond() {
    slowRequestArrived.fire();
    await releaseSlowRequest.fired;
    return { finished: true };
  }
}

describe('graceful shutdown', () => {
  let app: NestExpressApplication | undefined;

  afterEach(async () => {
    // Only does anything if the test failed before the app shut itself down.
    releaseSlowRequest.fire();
    if (app?.getHttpServer().listening) await app.close();
    jest.restoreAllMocks();
  });

  it('on SIGTERM finishes in-flight requests, refuses new ones and exits 0', async () => {
    const exit = jest
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as typeof process.exit);
    app = await createApp([SlowController]);
    await app.listen(0);
    const url = await app.getUrl();

    const inFlightResponse = request(url)
      .get('/api/slow')
      .then((response) => response);
    await slowRequestArrived.fired;

    process.emit('SIGTERM');

    await eventually(() => !app?.getHttpServer().listening);
    await expect(request(url).get('/api')).rejects.toThrow(/ECONNREFUSED/);
    expect(exit).not.toHaveBeenCalled();

    releaseSlowRequest.fire();
    const response = await inFlightResponse;
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ finished: true });

    await eventually(() => exit.mock.calls.length > 0);
    expect(exit).toHaveBeenCalledWith(0);
  });
});
