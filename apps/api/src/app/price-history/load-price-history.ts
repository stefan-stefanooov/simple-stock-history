import { decodeHourSummaries } from '@simple-stock-history/best-trade';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { isNativeError } from 'node:util/types';
import { PriceHistory } from './price-history';
import type { PriceHistoryFilePaths } from './price-history-file-paths.interface';
import {
  type PriceHistoryMeta,
  PriceHistoryMetaSchema,
} from './price-history-meta';

/** The Price History file holds each Price Point as one Int32 little-endian. */
const BYTES_PER_PRICE_POINT = Int32Array.BYTES_PER_ELEMENT;

/**
 * The summaries file holds 4 Int32 little-endian values per hour: lowest,
 * highest, buy and sell positions (ADR-0002).
 */
const BYTES_PER_HOUR_SUMMARY = 4 * Int32Array.BYTES_PER_ELEMENT;

/**
 * Thrown by {@link loadPriceHistory}; its message says which file is wrong
 * and why, for the startup log.
 */
export class PriceHistoryLoadError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'PriceHistoryLoadError';
  }
}

/**
 * Where the generator writes the hour summaries and the meta of the Price
 * History at `priceHistoryPath`: next to it, with the same base name
 * (`acme-2025-11.bin` → `acme-2025-11.hours.bin`, `acme-2025-11.meta.json`).
 */
export function priceHistoryFilePaths(
  priceHistoryPath: string,
): PriceHistoryFilePaths {
  if (!priceHistoryPath.endsWith('.bin')) {
    throw new PriceHistoryLoadError(
      `The Price History file must end in .bin, got "${priceHistoryPath}"`,
    );
  }
  return {
    priceHistory: priceHistoryPath,
    hourSummaries: priceHistoryPath.replace(/\.bin$/, '.hours.bin'),
    meta: priceHistoryPath.replace(/\.bin$/, '.meta.json'),
  };
}

/**
 * Reads the Price History at `priceHistoryPath`, its hour summaries and its
 * meta into memory, and verifies both binary files against the meta: their
 * sizes (`count` Price Points; `count / hourLength` hours, rounded up as the
 * last hour may be shorter) and their sha256. The hour summaries are read as
 * the generator wrote them, never rebuilt.
 *
 * @throws {PriceHistoryLoadError} when a file is missing, unreadable,
 * truncated, corrupt or does not match the meta.
 */
export async function loadPriceHistory(
  priceHistoryPath: string,
): Promise<PriceHistory> {
  const paths = priceHistoryFilePaths(priceHistoryPath);

  const meta = parseMeta(paths.meta, await read(paths.meta, 'meta'));

  const priceBytes = await read(paths.priceHistory, 'Price History');
  checkSize(
    'Price History',
    paths.priceHistory,
    priceBytes,
    meta.count * BYTES_PER_PRICE_POINT,
    `${meta.count} Price Points of ${BYTES_PER_PRICE_POINT} bytes`,
  );
  checkSha256('Price History', paths.priceHistory, priceBytes, meta.sha256);

  const hourBytes = await read(paths.hourSummaries, 'hour summaries');
  const hours = Math.ceil(meta.count / meta.hourLength);
  checkSize(
    'hour summaries',
    paths.hourSummaries,
    hourBytes,
    hours * BYTES_PER_HOUR_SUMMARY,
    `${hours} hours of ${BYTES_PER_HOUR_SUMMARY} bytes: ${meta.count} Price Points / hour length ${meta.hourLength}, rounded up`,
  );
  checkSha256(
    'hour summaries',
    paths.hourSummaries,
    hourBytes,
    meta.hourSummariesSha256,
  );

  return new PriceHistory(
    {
      from: meta.dataPeriodStart,
      to: meta.dataPeriodStart + meta.count - 1,
    },
    decodePrices(priceBytes),
    decodeHourSummaries(hourBytes, meta.hourLength),
  );
}

async function read(path: string, file: string): Promise<Buffer> {
  try {
    return await readFile(path);
  } catch (error) {
    throw new PriceHistoryLoadError(
      `Cannot read the ${file} file "${path}": ${messageOf(error)}`,
      { cause: error },
    );
  }
}

function parseMeta(path: string, bytes: Buffer): PriceHistoryMeta {
  let json: unknown;
  try {
    json = JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    throw new PriceHistoryLoadError(
      `The meta file "${path}" is not valid JSON: ${messageOf(error)}`,
      { cause: error },
    );
  }
  const result = PriceHistoryMetaSchema.safeParse(json);
  if (!result.success) {
    const problems = result.error.issues.map(
      (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`,
    );
    throw new PriceHistoryLoadError(
      `The meta file "${path}" is invalid: ${problems.join('; ')}`,
    );
  }
  return result.data;
}

function checkSize(
  file: string,
  path: string,
  bytes: Buffer,
  expectedBytes: number,
  expected: string,
): void {
  if (bytes.byteLength === expectedBytes) return;
  throw new PriceHistoryLoadError(
    `The ${file} file "${path}" is ${bytes.byteLength} bytes, but the meta ` +
      `calls for ${expectedBytes} (${expected}): it is truncated or does not ` +
      `belong to this meta`,
  );
}

function checkSha256(
  file: string,
  path: string,
  bytes: Buffer,
  expected: string,
): void {
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (actual === expected) return;
  throw new PriceHistoryLoadError(
    `The ${file} file "${path}" is corrupt: its sha256 is ${actual}, ` +
      `the meta expects ${expected}`,
  );
}

/** Decodes Int32 little-endian Price Points, whatever the machine's byte order. */
function decodePrices(bytes: Buffer): Int32Array {
  const prices = new Int32Array(bytes.byteLength / BYTES_PER_PRICE_POINT);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i < prices.length; i++) {
    prices[i] = view.getInt32(i * BYTES_PER_PRICE_POINT, true);
  }
  return prices;
}

function messageOf(error: unknown): string {
  // isNativeError also recognises errors from another realm, e.g. Node's fs
  // errors under Jest, which fail `instanceof Error`.
  return isNativeError(error) ? error.message : String(error);
}
