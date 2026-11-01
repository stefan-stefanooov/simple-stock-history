import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCli } from './cli.ts';

/** Encodes values as Int32 little-endian, independently of the generator. */
function int32LE(values: readonly number[]): Buffer {
  const bytes = Buffer.alloc(values.length * 4);
  values.forEach((value, i) => bytes.writeInt32LE(value, i * 4));
  return bytes;
}

function sha256Of(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

// The pinned first Price Points for seed 42 (see price-walk.spec.ts).
const SEED_42_PRICES = [
  10000, 9996, 9998, 9998, 9999, 10001, 9997, 9992, 9992, 9990, 9994, 9989,
  9989, 9993, 9995, 9992, 9996, 9991, 9996, 9998,
];
const SEED_42_BIN = int32LE(SEED_42_PRICES);
const SEED_42_SHA256 = sha256Of(SEED_42_BIN);

// The same Price Points in hours of 6, summarized by hand: per hour, the
// positions of its earliest lowest price, its earliest highest price, and the
// Buy Point and Sell Point of its own Best Trade. The last hour is shorter.
const HOUR_LENGTH = 6;
const SEED_42_HOURS_BIN = int32LE([
  ...[1, 5, 1, 5], // 10000 9996 9998 9998 9999 10001: buy 9996, sell 10001
  ...[11, 6, 9, 10], // 9997 9992 9992 9990 9994 9989: buy 9990, sell 9994
  ...[12, 16, 12, 16], // 9989 9993 9995 9992 9996 9991: buy 9989, sell 9996
  ...[18, 19, 18, 19], // 9996 9998: buy 9996, sell 9998
]);
const SEED_42_HOURS_SHA256 = sha256Of(SEED_42_HOURS_BIN);

const GENERATOR_VERSION = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
).version;

describe('runCli', () => {
  let dir: string;
  let stdout: string[];
  let stderr: string[];

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'price-history-generator-'));
    stdout = [];
    stderr = [];
    vi.spyOn(console, 'log').mockImplementation((line) => stdout.push(line));
    vi.spyOn(console, 'error').mockImplementation((line) => stderr.push(line));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(dir, { recursive: true, force: true });
  });

  function writeConfig(overrides: Record<string, unknown> = {}): string {
    const path = join(dir, 'config.json');
    const config = {
      seed: 42,
      dataPeriodStart: 1_761_955_200,
      count: SEED_42_PRICES.length,
      startPriceCents: 10_000,
      maxStepCents: 5,
      floorPriceCents: 100,
      sha256: SEED_42_SHA256,
      hourLength: HOUR_LENGTH,
      hourSummariesSha256: SEED_42_HOURS_SHA256,
      ...overrides,
    };
    writeFileSync(path, JSON.stringify(config));
    return path;
  }

  /** The generator's files that exist in the test directory. */
  function writtenFiles(): string[] {
    return ['acme.bin', 'acme.hours.bin', 'acme.meta.json'].filter((name) =>
      existsSync(join(dir, name)),
    );
  }

  it('writes the Price History, its hour summaries and its meta when both sha256 values match', () => {
    const out = join(dir, 'nested', 'acme.bin');

    expect(runCli(['--config', writeConfig(), '--out', out])).toBe(0);

    expect(readFileSync(out)).toEqual(SEED_42_BIN);
    expect(readFileSync(join(dir, 'nested', 'acme.hours.bin'))).toEqual(
      SEED_42_HOURS_BIN,
    );
    expect(
      JSON.parse(readFileSync(join(dir, 'nested', 'acme.meta.json'), 'utf8')),
    ).toEqual({
      dataPeriodStart: 1_761_955_200,
      count: 20,
      seed: 42,
      generatorVersion: GENERATOR_VERSION,
      sha256: SEED_42_SHA256,
      hourLength: HOUR_LENGTH,
      hourSummariesSha256: SEED_42_HOURS_SHA256,
    });
    expect(stdout.join('\n')).toContain(SEED_42_SHA256);
    expect(stdout.join('\n')).toContain(SEED_42_HOURS_SHA256);
  });

  it('writes −1 as the Buy Point and Sell Point of an hour with No Profitable Trade', () => {
    // Seed 42's first 8 Price Points in hours of 5. The second hour,
    // 10001 9997 9992, only falls.
    const hoursBin = int32LE([...[1, 0, 1, 4], ...[7, 5, -1, -1]]);
    const config = writeConfig({
      count: 8,
      sha256: sha256Of(SEED_42_BIN.subarray(0, 8 * 4)),
      hourLength: 5,
      hourSummariesSha256: sha256Of(hoursBin),
    });

    expect(runCli(['--config', config, '--out', join(dir, 'acme.bin')])).toBe(
      0,
    );
    expect(readFileSync(join(dir, 'acme.hours.bin'))).toEqual(hoursBin);
  });

  it('exits 1 and writes nothing when the Price History sha256 differs from the config', () => {
    const pinned = 'ab'.repeat(32);
    const out = join(dir, 'acme.bin');

    expect(
      runCli(['--config', writeConfig({ sha256: pinned }), '--out', out]),
    ).toBe(1);

    expect(writtenFiles()).toEqual([]);
    // Both hashes are shown, so a deliberate change can be pinned.
    expect(stderr.join('\n')).toContain(pinned);
    expect(stderr.join('\n')).toContain(SEED_42_SHA256);
    expect(stderr.join('\n')).not.toContain('hourSummariesSha256');
  });

  it('exits 1 and writes nothing when the hour summaries sha256 differs from the config', () => {
    const pinned = 'cd'.repeat(32);
    const out = join(dir, 'acme.bin');

    expect(
      runCli([
        '--config',
        writeConfig({ hourSummariesSha256: pinned }),
        '--out',
        out,
      ]),
    ).toBe(1);

    expect(writtenFiles()).toEqual([]);
    expect(stderr.join('\n')).toContain('hourSummariesSha256');
    expect(stderr.join('\n')).toContain(pinned);
    expect(stderr.join('\n')).toContain(SEED_42_HOURS_SHA256);
  });

  // ADR-0002: changing the hour length changes the pinned sha256.
  it('exits 1 and writes nothing when the hour length changes without a new pinned sha256', () => {
    const out = join(dir, 'acme.bin');

    expect(
      runCli(['--config', writeConfig({ hourLength: 5 }), '--out', out]),
    ).toBe(1);

    expect(writtenFiles()).toEqual([]);
    expect(stderr.join('\n')).toContain(SEED_42_HOURS_SHA256);
  });

  it('shows both mismatches when neither sha256 matches', () => {
    const config = writeConfig({
      sha256: 'ab'.repeat(32),
      hourSummariesSha256: 'cd'.repeat(32),
    });

    expect(runCli(['--config', config, '--out', join(dir, 'acme.bin')])).toBe(
      1,
    );

    expect(writtenFiles()).toEqual([]);
    expect(stderr.join('\n')).toContain(SEED_42_SHA256);
    expect(stderr.join('\n')).toContain(SEED_42_HOURS_SHA256);
  });

  it('exits 1 when the walk rejects the config', () => {
    const config = writeConfig({ startPriceCents: 99 });
    expect(runCli(['--config', config, '--out', join(dir, 'a.bin')])).toBe(1);
    expect(stderr.join('\n')).toMatch(/startPriceCents/);
  });

  it('exits 1 when the config is missing', () => {
    const config = join(dir, 'missing.json');
    expect(runCli(['--config', config, '--out', join(dir, 'a.bin')])).toBe(1);
    expect(stderr.join('\n')).toContain(config);
  });

  it.each([
    ['an --out path not ending in .bin', ['--out', 'acme.json']],
    ['an unknown option', ['--seed', '7']],
    ['a positional argument', ['acme.bin']],
  ])('exits 1 on %s', (_, args) => {
    expect(runCli(args)).toBe(1);
    expect(stderr).not.toEqual([]);
  });

  it('prints usage on --help', () => {
    expect(runCli(['--help'])).toBe(0);
    expect(stdout.join('\n')).toContain('--out <path>');
  });
});
