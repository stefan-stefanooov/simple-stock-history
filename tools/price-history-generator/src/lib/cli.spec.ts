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

// The pinned first Price Points for seed 42 (see price-walk.spec.ts), encoded
// here independently of the generator: Int32 little-endian, 4 bytes each.
const SEED_42_PRICES = [
  10000, 9996, 9998, 9998, 9999, 10001, 9997, 9992, 9992, 9990, 9994, 9989,
  9989, 9993, 9995, 9992, 9996, 9991, 9996, 9998,
];
const SEED_42_BIN = Buffer.alloc(SEED_42_PRICES.length * 4);
SEED_42_PRICES.forEach((price, i) => SEED_42_BIN.writeInt32LE(price, i * 4));
const SEED_42_SHA256 = createHash('sha256').update(SEED_42_BIN).digest('hex');

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
      ...overrides,
    };
    writeFileSync(path, JSON.stringify(config));
    return path;
  }

  it('writes the Price History and its meta when the sha256 matches', () => {
    const out = join(dir, 'nested', 'acme.bin');

    expect(runCli(['--config', writeConfig(), '--out', out])).toBe(0);

    expect(readFileSync(out)).toEqual(SEED_42_BIN);
    expect(
      JSON.parse(readFileSync(join(dir, 'nested', 'acme.meta.json'), 'utf8')),
    ).toEqual({
      dataPeriodStart: 1_761_955_200,
      count: 20,
      seed: 42,
      generatorVersion: GENERATOR_VERSION,
      sha256: SEED_42_SHA256,
    });
    expect(stdout.join('\n')).toContain(SEED_42_SHA256);
  });

  it('exits 1 and writes nothing when the sha256 differs from the config', () => {
    const pinned = 'ab'.repeat(32);
    const out = join(dir, 'acme.bin');

    expect(
      runCli(['--config', writeConfig({ sha256: pinned }), '--out', out]),
    ).toBe(1);

    expect(existsSync(out)).toBe(false);
    expect(existsSync(join(dir, 'acme.meta.json'))).toBe(false);
    // Both hashes are shown, so a deliberate change can be pinned.
    expect(stderr.join('\n')).toContain(pinned);
    expect(stderr.join('\n')).toContain(SEED_42_SHA256);
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
