// Entry point of the generator CLI. Node runs this file as is (type
// stripping), so every import in this package uses its `.ts` path.
import { runCli } from './lib/cli.ts';

process.exitCode = runCli(process.argv.slice(2));
