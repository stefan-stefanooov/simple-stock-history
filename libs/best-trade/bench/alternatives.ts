// Times every Best Trade search option from ADR-0002 on the real Price History,
// over Time Slices from a minute to the whole Data Period, and prints the
// results as JSON. A manual benchmark, not a test; the numbers and charts in
// docs/best-trade-alternatives come from it.
//
//   nx run price-history-generator:generate
//   node --max-old-space-size=2048 libs/best-trade/bench/alternatives.ts > /tmp/alternatives.json
//   node libs/best-trade/bench/alternatives-charts.mjs /tmp/alternatives.json docs/best-trade-alternatives
//
// Every option is checked against the plain loop before it is timed.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import {
  buildHourSummaries,
  createBestTradeSearch,
  HOUR_LENGTH,
  type TradePositions,
} from '../src/index.ts';

const NO_TRADE = -1;
/** Values per summary in the segment tree: lowest, highest, buy, sell. */
const NODE_SIZE = 4;

const path = process.argv[2] ?? 'data/acme-2025-11.bin';

// Read and hash the Price History, as the API does at startup; the median of
// a few runs, since a single read is noisy.
const loadRuns: number[] = [];
let prices: Int32Array = new Int32Array(0);
for (let run = 0; run < 7; run++) {
  const start = performance.now();
  const bytes = readFileSync(path);
  createHash('sha256').update(bytes).digest('hex');
  prices = decodePrices(bytes);
  loadRuns.push(performance.now() - start);
}
const count = prices.length;

// ---------- Plain loop ----------

/** One pass over the Time Slice, tracking the earliest lowest price. */
function plainLoop(
  p: Int32Array,
  first: number,
  last: number,
): TradePositions | null {
  let lowest = first;
  let buy = NO_TRADE;
  let sell = NO_TRADE;
  let bestProfit = 0;
  for (let i = first + 1; i <= last; i++) {
    const profit = p[i] - p[lowest];
    if (profit > bestProfit) {
      bestProfit = profit;
      buy = lowest;
      sell = i;
    }
    if (p[i] < p[lowest]) lowest = i;
  }
  return buy === NO_TRADE ? null : { buy, sell };
}

// ---------- Hour summaries (chosen) ----------

const buildRuns: number[] = [];
let summaries = buildHourSummaries(prices, HOUR_LENGTH);
for (let run = 0; run < 20; run++) {
  const start = performance.now();
  summaries = buildHourSummaries(prices, HOUR_LENGTH);
  buildRuns.push(performance.now() - start);
}
const hourSearch = createBestTradeSearch(prices, summaries);

// ---------- Segment tree down to single seconds ----------

// Bottom-up tree with the leaves at [count, 2 × count): each node holds the
// same 4 values as an hour summary, and a parent joins its two children.
const segmentTreeStart = performance.now();
const tree = new Int32Array(2 * count * NODE_SIZE);
for (let i = 0; i < count; i++) {
  tree.set([i, i, NO_TRADE, NO_TRADE], (count + i) * NODE_SIZE);
}
for (let node = count - 1; node >= 1; node--) {
  joinInto(
    tree,
    node * NODE_SIZE,
    tree,
    2 * node * NODE_SIZE,
    tree,
    (2 * node + 1) * NODE_SIZE,
  );
}
const segmentTreeBuildMs = performance.now() - segmentTreeStart;

/**
 * Whether the candidate Trade beats the current one: highest Profit, then
 * earliest Buy Point, then earliest Sell Point.
 */
function isBetterTrade(
  buy: number,
  sell: number,
  candidateBuy: number,
  candidateSell: number,
): boolean {
  if (candidateBuy === NO_TRADE) return false;
  if (buy === NO_TRADE) return true;
  const profit = prices[sell] - prices[buy];
  const candidateProfit = prices[candidateSell] - prices[candidateBuy];
  if (candidateProfit !== profit) return candidateProfit > profit;
  if (candidateBuy !== buy) return candidateBuy < buy;
  return candidateSell < sell;
}

/** Writes the join of `left` and the piece `right` directly after it to `out`. */
function joinInto(
  out: Int32Array,
  at: number,
  left: Int32Array,
  l: number,
  right: Int32Array,
  r: number,
): void {
  let buy = left[l + 2];
  let sell = left[l + 3];
  if (isBetterTrade(buy, sell, right[r + 2], right[r + 3])) {
    buy = right[r + 2];
    sell = right[r + 3];
  }
  const crossBuy = left[l];
  const crossSell = right[r + 1];
  if (
    prices[crossSell] > prices[crossBuy] &&
    isBetterTrade(buy, sell, crossBuy, crossSell)
  ) {
    buy = crossBuy;
    sell = crossSell;
  }
  out[at] = prices[right[r]] < prices[left[l]] ? right[r] : left[l];
  out[at + 1] =
    prices[right[r + 1]] > prices[left[l + 1]] ? right[r + 1] : left[l + 1];
  out[at + 2] = buy;
  out[at + 3] = sell;
}

/** Copies a node without allocating, so the timing measures the search only. */
function copyNode(from: Int32Array, at: number, to: Int32Array): void {
  to[0] = from[at];
  to[1] = from[at + 1];
  to[2] = from[at + 2];
  to[3] = from[at + 3];
}

const fromLeft = new Int32Array(NODE_SIZE);
const fromRight = new Int32Array(NODE_SIZE);
const joined = new Int32Array(NODE_SIZE);

/** Joins O(log n) nodes, keeping the left and right halves in time order. */
function segmentTreeSearch(first: number, last: number): TradePositions | null {
  let hasLeft = false;
  let hasRight = false;
  for (let l = first + count, r = last + count + 1; l < r; l >>= 1, r >>= 1) {
    if (l & 1) {
      if (hasLeft) {
        joinInto(joined, 0, fromLeft, 0, tree, l * NODE_SIZE);
        copyNode(joined, 0, fromLeft);
      } else {
        copyNode(tree, l * NODE_SIZE, fromLeft);
        hasLeft = true;
      }
      l++;
    }
    if (r & 1) {
      r--;
      if (hasRight) {
        joinInto(joined, 0, tree, r * NODE_SIZE, fromRight, 0);
        copyNode(joined, 0, fromRight);
      } else {
        copyNode(tree, r * NODE_SIZE, fromRight);
        hasRight = true;
      }
    }
  }
  let result = hasLeft ? fromLeft : fromRight;
  if (hasLeft && hasRight) {
    joinInto(joined, 0, fromLeft, 0, fromRight, 0);
    result = joined;
  }
  return result[2] === NO_TRADE ? null : { buy: result[2], sell: result[3] };
}

// ---------- Per-hour arrays, concatenated per query ----------

const hourArrays: Int32Array[] = [];
for (let first = 0; first < count; first += HOUR_LENGTH) {
  hourArrays.push(prices.slice(first, Math.min(first + HOUR_LENGTH, count)));
}

/** Copies the Time Slice out of the per-hour arrays, then loops over it. */
function concatenatedSearch(
  first: number,
  last: number,
): TradePositions | null {
  const slice = new Int32Array(last - first + 1);
  let written = 0;
  const lastHour = Math.floor(last / HOUR_LENGTH);
  for (let hour = Math.floor(first / HOUR_LENGTH); hour <= lastHour; hour++) {
    const hourStart = hour * HOUR_LENGTH;
    const from = Math.max(first, hourStart) - hourStart;
    const to = Math.min(last, hourStart + HOUR_LENGTH - 1) - hourStart;
    slice.set(hourArrays[hour].subarray(from, to + 1), written);
    written += to - from + 1;
  }
  const found = plainLoop(slice, 0, slice.length - 1);
  return found && { buy: found.buy + first, sell: found.sell + first };
}

// ---------- Measure ----------

/** Median time of `run` in ms, after warming up. */
function medianMs(run: () => unknown): number {
  const warmUpStart = performance.now();
  for (let i = 0; i < 50 || performance.now() - warmUpStart < 100; i++) run();
  const samples: number[] = [];
  const start = performance.now();
  while (
    samples.length < 30 ||
    (performance.now() - start < 400 && samples.length < 5_000)
  ) {
    const before = performance.now();
    run();
    samples.push(performance.now() - before);
  }
  return median(samples);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

// Each Time Slice starts at position 1, so its first hour is partial, as in
// the worst case; the last one is the worst case itself (worst-case-time-slice.ts).
const timeSlices: [label: string, length: number][] = [
  ['1 min', 60],
  ['10 min', 600],
  ['1 h', 3_600],
  ['6 h', 21_600],
  ['1 day', 86_400],
  ['1 week', 604_800],
  ['30 days', count - 2],
];

const rows = timeSlices.map(([label, length]) => {
  const first = 1;
  const last = Math.min(first + length - 1, count - 2);
  const expected = JSON.stringify(plainLoop(prices, first, last));
  const options = {
    'hour summaries': () => hourSearch.find(first, last),
    'segment tree': () => segmentTreeSearch(first, last),
    'per-hour arrays': () => concatenatedSearch(first, last),
  };
  for (const [name, search] of Object.entries(options)) {
    const found = JSON.stringify(search());
    if (found !== expected) {
      throw new Error(
        `${name} found ${found} for ${label}, the plain loop ${expected}`,
      );
    }
  }
  return {
    label,
    length: last - first + 1,
    plainMs: medianMs(() => plainLoop(prices, first, last)),
    hourMs: medianMs(options['hour summaries']),
    segMs: medianMs(options['segment tree']),
    concatMs: medianMs(options['per-hour arrays']),
  };
});

console.log(
  JSON.stringify(
    {
      node: process.version,
      pricePoints: count,
      loadAndHashMs: median(loadRuns),
      hourSummariesBuildMs: median(buildRuns),
      segmentTreeBuildMs,
      memoryBytes: {
        priceHistory: prices.byteLength,
        hourSummaries: summaries.values.byteLength,
        segmentTree: tree.byteLength,
        perHourArrays: hourArrays.reduce((sum, a) => sum + a.byteLength, 0),
      },
      rows,
    },
    null,
    2,
  ),
);

function decodePrices(file: Buffer): Int32Array {
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  const result = new Int32Array(file.byteLength / 4);
  for (let i = 0; i < result.length; i++) {
    result[i] = view.getInt32(i * 4, true);
  }
  return result;
}
