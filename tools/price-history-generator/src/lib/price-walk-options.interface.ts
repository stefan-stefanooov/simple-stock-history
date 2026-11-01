/** Everything that determines a generated Price History. */
export interface PriceWalkOptions {
  /** PRNG seed, an unsigned 32-bit integer. */
  seed: number;
  /** Number of Price Points to produce, one per second. */
  count: number;
  /** Price of the first Price Point, in cents. */
  startPriceCents: number;
  /** Each step is drawn uniformly from −maxStepCents…+maxStepCents. */
  maxStepCents: number;
  /** Lowest price allowed, in cents. A step that would go below it is reflected. */
  floorPriceCents: number;
}
