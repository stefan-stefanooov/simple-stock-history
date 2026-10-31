import { loadConfig } from '../config/app-config';
import { createPinoHttpOptions } from './pino-http-options';

describe('createPinoHttpOptions', () => {
  it('pretty-prints through pino-pretty under NODE_ENV=development', () => {
    const options = createPinoHttpOptions(
      loadConfig({ NODE_ENV: 'development' }),
    );

    expect(options.transport).toMatchObject({ target: 'pino-pretty' });
  });

  it.each(['production', 'test'])(
    'writes plain JSON under NODE_ENV=%s',
    (nodeEnv) => {
      const options = createPinoHttpOptions(loadConfig({ NODE_ENV: nodeEnv }));

      expect(options.transport).toBeUndefined();
    },
  );

  it('logs at LOG_LEVEL', () => {
    const options = createPinoHttpOptions(loadConfig({ LOG_LEVEL: 'warn' }));

    expect(options.level).toBe('warn');
  });
});
