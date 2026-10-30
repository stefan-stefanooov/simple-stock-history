/** Throws a RangeError unless `value` is an integer in `min`…`max` (both included). */
export function assertIntegerInRange(
  name: string,
  value: number,
  min: number,
  max: number,
): void {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(
      `${name} must be an integer in ${min}…${max}, got ${value}`,
    );
  }
}
