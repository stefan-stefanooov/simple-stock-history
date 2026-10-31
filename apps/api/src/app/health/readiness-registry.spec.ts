import { Logger } from '@nestjs/common';
import { ReadinessRegistry } from './readiness-registry';

describe('ReadinessRegistry', () => {
  let registry: ReadinessRegistry;

  beforeEach(() => {
    registry = new ReadinessRegistry();
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('is ready with no readiness checks registered', async () => {
    expect(await registry.check()).toEqual({ ready: true, checks: {} });
  });

  it('is ready when every readiness check passes, sync or async', async () => {
    registry.register('price-history', () => true);
    registry.register('hour-summaries', async () => true);

    expect(await registry.check()).toEqual({
      ready: true,
      checks: { 'price-history': 'pass', 'hour-summaries': 'pass' },
    });
  });

  it('is not ready when any readiness check fails', async () => {
    registry.register('price-history', () => true);
    registry.register('hour-summaries', () => false);

    expect(await registry.check()).toEqual({
      ready: false,
      checks: { 'price-history': 'pass', 'hour-summaries': 'fail' },
    });
  });

  it('counts a readiness check that throws or rejects as failing', async () => {
    registry.register('throws', () => {
      throw new Error('boom');
    });
    registry.register('rejects', () => Promise.reject(new Error('boom')));

    expect(await registry.check()).toEqual({
      ready: false,
      checks: { throws: 'fail', rejects: 'fail' },
    });
  });

  it('runs each readiness check on every call, so readiness follows the state it reports', async () => {
    let loaded = false;
    registry.register('price-history', () => loaded);

    expect((await registry.check()).ready).toBe(false);
    loaded = true;
    expect((await registry.check()).ready).toBe(true);
  });

  it('refuses a second readiness check under the same name', () => {
    registry.register('price-history', () => true);

    expect(() => registry.register('price-history', () => true)).toThrow(
      'Readiness check "price-history" is already registered',
    );
  });

  it('refuses a readiness check without a name', () => {
    expect(() => registry.register(' ', () => true)).toThrow(
      'A readiness check needs a name',
    );
  });

  describe('logging', () => {
    it('logs once when a readiness check starts passing, not on every probe', async () => {
      let loaded = false;
      registry.register('price-history', () => loaded);

      await registry.check();
      loaded = true;
      await registry.check();
      await registry.check();

      expect(Logger.prototype.log).toHaveBeenCalledTimes(1);
      expect(Logger.prototype.log).toHaveBeenCalledWith(
        'Readiness check "price-history" passes',
      );
      expect(Logger.prototype.warn).not.toHaveBeenCalled();
    });

    it('warns once when a readiness check that passed starts failing', async () => {
      let loaded = true;
      registry.register('price-history', () => loaded);

      await registry.check();
      loaded = false;
      await registry.check();
      await registry.check();

      expect(Logger.prototype.warn).toHaveBeenCalledTimes(1);
      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        'Readiness check "price-history" fails',
      );
    });

    it('logs the error once when a readiness check throws', async () => {
      registry.register('price-history', () => {
        throw new Error('boom');
      });

      await registry.check();
      await registry.check();

      expect(Logger.prototype.error).toHaveBeenCalledTimes(1);
      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Readiness check "price-history" fails: it threw',
        expect.stringContaining('Error: boom'),
      );
    });
  });
});
