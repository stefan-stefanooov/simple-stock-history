import { assertIntegerInRange } from './assert-integer.ts';

const UINT32_MAX = 0xffff_ffff;

/**
 * mulberry32, a seeded 32-bit PRNG, kept in-repo so the Price History never
 * depends on a library or engine whose output could change (ADR-0001).
 *
 * Returns a function that yields the next unsigned 32-bit integer on each call.
 * Unlike the usual published version it doesn't divide by 2^32 to return a
 * float: every operation here is 32-bit integer arithmetic (`Math.imul`,
 * bitwise ops), which the language defines exactly.
 */
export function mulberry32(seed: number): () => number {
  assertIntegerInRange('seed', seed, 0, UINT32_MAX);
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b_79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
}
