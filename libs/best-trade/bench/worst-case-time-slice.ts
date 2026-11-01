// Times the worst-case Time Slice on the full Data Period (ADR-0002 budget:
// ≤ 1 ms after warm-up on a dev machine). A manual benchmark, not a test.
//
//   nx run price-history-generator:generate
//   node libs/best-trade/bench/worst-case-time-slice.ts [data/acme-2025-11.bin]
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import {
  buildHourSummaries,
  createBestTradeSearch,
  decodeHourSummaries,
  encodeHourSummaries,
  HOUR_LENGTH,
  type TradePositions,
} from '../src/index.ts';

const WARM_UP_RUNS = 1_000;
const TIMED_RUNS = 1_000;

const path = process.argv[2] ?? 'data/acme-2025-11.bin';
const prices = readPriceHistory(path);

const start = performance.now();
const summaries = buildHourSummaries(prices, HOUR_LENGTH);
const buildMs = performance.now() - start;
// Search over summaries read back from the summaries file, as the API will.
const search = createBestTradeSearch(
  prices,
  decodeHourSummaries(encodeHourSummaries(summaries), HOUR_LENGTH),
);

// Two almost-whole partial hours at the ends, every other hour joined from
// its summary: the most Price Points a query ever loops over.
const first = 1;
const last = prices.length - 2;

const found = search.find(first, last);
const expected = plainLoop(prices, first, last);
if (found?.buy !== expected?.buy || found?.sell !== expected?.sell) {
  throw new Error(
    `Best Trade search found ${JSON.stringify(found)}, the plain loop ${JSON.stringify(expected)}`,
  );
}

const searchMs = time(() => search.find(first, last));
const plainLoopMs = time(() => plainLoop(prices, first, last));

const hours = summaries.values.length / 4; // 4 values per hour
console.log(`Price History: ${prices.length} Price Points, ${hours} hours`);
console.log(`Hour summaries built in ${buildMs.toFixed(1)} ms`);
console.log(
  `Time Slice ${first}…${last}: Best Trade ${JSON.stringify(found)}, ${hours - 2} hour summaries joined`,
);
console.log(`Best Trade search: ${describe(searchMs)}`);
console.log(`Plain loop:        ${describe(plainLoopMs)}`);

function readPriceHistory(file: string): Int32Array {
  const bytes = readFileSync(file);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const result = new Int32Array(bytes.byteLength / 4);
  for (let i = 0; i < result.length; i++) {
    result[i] = view.getInt32(i * 4, true);
  }
  return result;
}

/** The rejected approach: one loop over every Price Point in the Time Slice. */
function plainLoop(
  p: Int32Array,
  from: number,
  to: number,
): TradePositions | null {
  let lowest = from;
  let best: TradePositions | null = null;
  let bestProfit = 0;
  for (let i = from + 1; i <= to; i++) {
    const profit = p[i] - p[lowest];
    if (profit > bestProfit) {
      bestProfit = profit;
      best = { buy: lowest, sell: i };
    } else if (p[i] < p[lowest]) {
      lowest = i;
    }
  }
  return best;
}

function time(run: () => unknown): number[] {
  for (let i = 0; i < WARM_UP_RUNS; i++) run();
  const samples: number[] = [];
  for (let i = 0; i < TIMED_RUNS; i++) {
    const before = performance.now();
    run();
    samples.push(performance.now() - before);
  }
  return samples.sort((a, b) => a - b);
}

function describe(sortedMs: number[]): string {
  const at = (q: number) =>
    sortedMs[Math.min(sortedMs.length - 1, Math.floor(q * sortedMs.length))];
  return `median ${at(0.5).toFixed(4)} ms, p99 ${at(0.99).toFixed(4)} ms, max ${at(1).toFixed(4)} ms (${sortedMs.length} runs after ${WARM_UP_RUNS} warm-up)`;
}
