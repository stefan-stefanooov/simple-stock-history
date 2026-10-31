import { z } from 'zod';

// zod 4 compiles fast object parsers with `new Function`, and the first time a
// schema is built it probes whether `new Function` is allowed. The web app is
// served under a CSP without 'unsafe-eval', so the browser reports that probe
// as a CSP violation on every page load, even though zod catches the error.
// Jitless mode skips both the probe and the compiled parsers. It is set here,
// once, so the API and the web app validate the same way.
//
// zod reads this setting when a schema is created, so this module must be
// evaluated before any schema: index.ts imports it first.
z.config({ jitless: true });
