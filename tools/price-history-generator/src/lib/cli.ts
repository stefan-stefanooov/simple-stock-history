import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { parsePriceHistoryConfig } from './price-history-config.ts';
import { generatePriceHistoryFile } from './price-history-file.ts';

/** The committed config that pins the Share's Price History. */
export const DEFAULT_CONFIG_PATH = fileURLToPath(
  new URL('../../price-history.config.json', import.meta.url),
);
/** Where the Price History is written, relative to the working directory. */
export const DEFAULT_OUT_PATH = 'data/acme-2025-11.bin';

const PACKAGE_JSON_PATH = fileURLToPath(
  new URL('../../package.json', import.meta.url),
);

const USAGE = `Usage: node tools/price-history-generator/src/main.ts [options]

Generates the Share's Price History from its committed config, checks its
sha256 against the one pinned there, then writes the .bin file and, next to
it, a .meta.json file. Writes nothing and exits 1 if the sha256 differs.

Options:
  --config <path>  Config file (default: ${DEFAULT_CONFIG_PATH})
  --out <path>     Price History file, must end in .bin; the meta goes to
                   the same path ending in .meta.json
                   (default: ${DEFAULT_OUT_PATH})
  --help           Show this help`;

/**
 * Runs the generator CLI with the given arguments (without `node` and the
 * script path) and returns the process exit code: 0 on success, 1 on any
 * failure, including a sha256 that differs from the config's.
 */
export function runCli(args: readonly string[]): number {
  let options: { config: string; out: string; help: boolean };
  try {
    ({ values: options } = parseArgs({
      args: [...args],
      options: {
        config: { type: 'string', default: DEFAULT_CONFIG_PATH },
        out: { type: 'string', default: DEFAULT_OUT_PATH },
        help: { type: 'boolean', default: false },
      },
      strict: true,
      allowPositionals: false,
    }));
  } catch (error) {
    return fail(`${messageOf(error)}\n\n${USAGE}`);
  }
  if (options.help) {
    console.log(USAGE);
    return 0;
  }
  if (!options.out.endsWith('.bin')) {
    return fail(`--out must end in .bin, got ${options.out}`);
  }
  const metaPath = options.out.replace(/\.bin$/, '.meta.json');

  try {
    const config = parsePriceHistoryConfig(readJson(options.config));
    const { version } = readJson(PACKAGE_JSON_PATH) as { version: string };
    const { bytes, meta } = generatePriceHistoryFile(config, version);

    if (meta.sha256 !== config.sha256) {
      return fail(
        [
          'The generated Price History does not match the pinned sha256.',
          `  expected (${options.config}): ${config.sha256}`,
          `  actual: ${meta.sha256}`,
          'If you changed the generator or its config on purpose, pin the actual sha256 in the config.',
        ].join('\n'),
      );
    }

    mkdirSync(dirname(options.out), { recursive: true });
    writeFileSync(options.out, bytes);
    writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`);
    console.log(
      `Wrote ${meta.count} Price Points to ${options.out} and ${metaPath} (sha256 ${meta.sha256})`,
    );
    return 0;
  } catch (error) {
    return fail(messageOf(error));
  }
}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read ${path}: ${messageOf(error)}`);
  }
}

function fail(message: string): number {
  console.error(message);
  return 1;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
