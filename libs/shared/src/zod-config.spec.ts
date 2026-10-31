import { z } from 'zod';

// The web app's CSP has no 'unsafe-eval', so zod must never probe or use
// `new Function`. Vitest runs each spec file with its own modules, so the
// package is not loaded yet when this test starts.
describe('zod config', () => {
  it('turns on jitless mode when the package is imported', async () => {
    expect(z.config().jitless).toBeFalsy();

    await import('./index.js');

    expect(z.config().jitless).toBe(true);
  });
});
