import { mulberry32 } from './mulberry32.ts';

function firstDraws(seed: number, n: number): number[] {
  const next = mulberry32(seed);
  return Array.from({ length: n }, () => next());
}

describe('mulberry32', () => {
  // From the published float-returning mulberry32 (bryc/code), scaled by 2^32.
  it.each([
    [0, [1144304738, 1416247, 958946056, 627933444, 2007157716]],
    [42, [2581720956, 1925393290, 3661312704, 2876485805, 750819978]],
    [0xffff_ffff, [3850105811, 813802916, 3073704848, 4054706436, 3630262831]],
  ])('matches the reference implementation for seed %i', (seed, expected) => {
    expect(firstDraws(seed, 5)).toEqual(expected);
  });

  it('gives the same sequence for the same seed', () => {
    expect(firstDraws(7, 1000)).toEqual(firstDraws(7, 1000));
  });

  it('yields unsigned 32-bit integers', () => {
    const notUint32 = firstDraws(7, 10_000).filter(
      (draw) => !Number.isInteger(draw) || draw < 0 || draw > 0xffff_ffff,
    );
    expect(notUint32).toEqual([]);
  });

  it.each([-1, 0x1_0000_0000, 1.5, Number.NaN])(
    'rejects seed %s, which is not an unsigned 32-bit integer',
    (seed) => {
      expect(() => mulberry32(seed)).toThrow(RangeError);
    },
  );
});
