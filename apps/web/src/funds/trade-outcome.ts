import type { Trade } from '@simple-stock-history/shared';

/**
 * What Available Funds would have made on a Best Trade: buy as many whole
 * shares as they afford at the Buy Point and sell them all at the Sell Point.
 * Every amount is in integer cents.
 */
export type TradeOutcome =
  | {
      /** The funds do not cover the Buy Point's price of one share. */
      kind: 'insufficient-funds';
      fundsCents: number;
      buyPriceCents: number;
    }
  | {
      kind: 'shares-bought';
      /** Whole shares bought at the Buy Point and sold at the Sell Point. */
      shares: number;
      /** What the shares cost at the Buy Point. */
      spentCents: number;
      /** Available Funds left unspent, less than the price of one share. */
      leftoverCents: number;
      /** The Trade's Profit, which is per share, times the number of shares. */
      totalProfitCents: number;
    };

/**
 * Applies Available Funds, in cents, to a Trade (normally the Best Trade).
 * Every amount comes out as an exact integer number of cents.
 *
 * @throws RangeError if the arguments break their contract: `fundsCents` must
 * be a non-negative safe integer (as returned by `parseAvailableFunds`), the
 * Buy Point's price and the Profit positive safe integers (as `TradeSchema`
 * guarantees). Also if the total Profit is too large to be exact, which at the
 * maximum Available Funds takes a Sell Point priced about 900,000 times the
 * Buy Point, while the Price History's highest possible price is about
 * 130,000 times its lowest.
 */
export function calculateTradeOutcome(
  fundsCents: number,
  trade: Trade,
): TradeOutcome {
  const buyPriceCents = trade.buy.priceCents;
  assertSafeInteger(fundsCents, 'fundsCents', 0);
  assertSafeInteger(buyPriceCents, 'trade.buy.priceCents', 1);
  assertSafeInteger(trade.profitCents, 'trade.profitCents', 1);

  if (fundsCents < buyPriceCents) {
    return { kind: 'insufficient-funds', fundsCents, buyPriceCents };
  }

  // Exact: for safe integers the quotient is never within half a unit in the
  // last place of the next integer, so it cannot round up to it.
  const shares = Math.floor(fundsCents / buyPriceCents);
  const spentCents = shares * buyPriceCents;
  const leftoverCents = fundsCents - spentCents;

  // The product of two safe integers is exact if and only if it is safe.
  const totalProfitCents = shares * trade.profitCents;
  if (!Number.isSafeInteger(totalProfitCents)) {
    throw new RangeError(
      `Total Profit of ${shares} shares at ${trade.profitCents} cents each is too large to be exact`,
    );
  }

  return {
    kind: 'shares-bought',
    shares,
    spentCents,
    leftoverCents,
    totalProfitCents,
  };
}

function assertSafeInteger(value: number, name: string, min: number): void {
  if (!Number.isSafeInteger(value) || value < min) {
    throw new RangeError(
      `${name} must be a safe integer of at least ${min}, got ${value}`,
    );
  }
}
