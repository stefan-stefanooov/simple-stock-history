import { InvalidConfigError, loadConfig } from './app-config';

describe('loadConfig', () => {
  it('falls back to the defaults when nothing is set', () => {
    expect(loadConfig({})).toEqual({
      nodeEnv: 'production',
      port: 3000,
      logLevel: 'info',
      priceHistoryPath: 'data/acme-2025-11.bin',
      swaggerEnabled: true,
    });
  });

  it('reads every variable', () => {
    expect(
      loadConfig({
        NODE_ENV: 'development',
        PORT: '8080',
        LOG_LEVEL: 'debug',
        PRICE_HISTORY_PATH: '/app/data/acme-2025-11.bin',
        SWAGGER_ENABLED: 'false',
      }),
    ).toEqual({
      nodeEnv: 'development',
      port: 8080,
      logLevel: 'debug',
      priceHistoryPath: '/app/data/acme-2025-11.bin',
      swaggerEnabled: false,
    });
  });

  it('silences logs under NODE_ENV=test unless LOG_LEVEL asks for them', () => {
    expect(loadConfig({ NODE_ENV: 'test' }).logLevel).toBe('silent');
    expect(loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'info' }).logLevel).toBe(
      'info',
    );
  });

  it.each([
    ['true', true],
    ['TRUE', true],
    ['false', false],
    ['False', false],
  ])('reads SWAGGER_ENABLED=%s as %s', (value, expected) => {
    expect(loadConfig({ SWAGGER_ENABLED: value }).swaggerEnabled).toBe(
      expected,
    );
  });

  it.each(['', 'abc', '0', '65536', '3.5'])('rejects PORT=%j', (port) => {
    expect(() => loadConfig({ PORT: port })).toThrow(
      'PORT: must be a whole number from 1 to 65535',
    );
  });

  it('rejects an empty PRICE_HISTORY_PATH', () => {
    expect(() => loadConfig({ PRICE_HISTORY_PATH: '  ' })).toThrow(
      'PRICE_HISTORY_PATH: must not be empty',
    );
  });

  it('lists every invalid variable in one readable message', () => {
    const load = () =>
      loadConfig({
        NODE_ENV: 'staging',
        PORT: 'eighty',
        LOG_LEVEL: 'loud',
        SWAGGER_ENABLED: 'yes',
      });

    expect(load).toThrow(InvalidConfigError);
    expect(load).toThrow(
      [
        'Invalid configuration, the API cannot start:',
        '  - NODE_ENV: Invalid option: expected one of "development"|"production"|"test"',
        '  - PORT: must be a whole number from 1 to 65535',
        '  - LOG_LEVEL: Invalid option: expected one of "fatal"|"error"|"warn"|"info"|"debug"|"trace"|"silent"',
        '  - SWAGGER_ENABLED: Invalid option: expected one of "true"|"false"',
      ].join('\n'),
    );
  });
});
