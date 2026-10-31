import type { Trade } from '@simple-stock-history/shared';
import { MAX_AVAILABLE_FUNDS_CENTS } from './available-funds';
import { calculateTradeOutcome } from './trade-outcome';

function trade(buyPriceCents: number, sellPriceCents: number): Trade {
  return {
    buy: { time: 1_761_955_200, priceCents: buyPriceCents },
    sell: { time: 1_761_955_260, priceCents: sellPriceCents },
    profitCents: sellPriceCents - buyPriceCents,
  };
}

describe('calculateTradeOutcome', () => {
  it('buys as many whole shares as the funds afford and keeps the rest', () => {
    // $1,000.00 at $30.00 a share: 33 shares for $990.00, $10.00 left over,
    // $2.50 Profit per share.
    expect(calculateTradeOutcome(100_000, trade(3_000, 3_250))).toEqual({
      kind: 'shares-bought',
      shares: 33,
      spentCents: 99_000,
      leftoverCents: 1_000,
      totalProfitCents: 8_250,
    });
  });

  it('spends everything when the funds are an exact multiple of the price', () => {
    expect(calculateTradeOutcome(10_100, trade(101, 102))).toEqual({
      kind: 'shares-bought',
      shares: 100,
      spentCents: 10_100,
      leftoverCents: 0,
      totalProfitCents: 100,
    });
  });

  it('buys one share when the funds are exactly its price', () => {
    expect(calculateTradeOutcome(10_050, trade(10_050, 10_051))).toEqual({
      kind: 'shares-bought',
      shares: 1,
      spentCents: 10_050,
      leftoverCents: 0,
      totalProfitCents: 1,
    });
  });

  it.each([0, 1, 10_049])(
    'reports insufficient funds when %i cents do not buy one share',
    (fundsCents) => {
      expect(calculateTradeOutcome(fundsCents, trade(10_050, 10_100))).toEqual({
        kind: 'insufficient-funds',
        fundsCents,
        buyPriceCents: 10_050,
      });
    },
  );

  it('stays exact at the maximum Available Funds', () => {
    // $100,000,000.00 at $1.00 a share, sold at $129,699.95: the lowest and
    // highest prices the Price History's walk could ever reach.
    expect(
      calculateTradeOutcome(MAX_AVAILABLE_FUNDS_CENTS, trade(100, 12_969_995)),
    ).toEqual({
      kind: 'shares-bought',
      shares: 100_000_000,
      spentCents: 10_000_000_000,
      leftoverCents: 0,
      totalProfitCents: 1_296_989_500_000_000,
    });
  });

  it('stays exact for funds near Number.MAX_SAFE_INTEGER', () => {
    const fundsCents = Number.MAX_SAFE_INTEGER;
    const outcome = calculateTradeOutcome(fundsCents, trade(3, 4));
    expect(outcome).toEqual({
      kind: 'shares-bought',
      shares: 3_002_399_751_580_330,
      spentCents: 9_007_199_254_740_990,
      leftoverCents: 1,
      totalProfitCents: 3_002_399_751_580_330,
    });
  });

  it('throws when the total Profit would be too large to be exact', () => {
    expect(() =>
      calculateTradeOutcome(Number.MAX_SAFE_INTEGER, trade(1, 3)),
    ).toThrow(RangeError);
  });

  it.each([
    ['negative funds', -1, trade(100, 200)],
    ['fractional funds', 100.5, trade(100, 200)],
    ['unsafe funds', Number.MAX_SAFE_INTEGER + 1, trade(100, 200)],
    ['NaN funds', NaN, trade(100, 200)],
    ['a zero Buy Point price', 100, trade(0, 200)],
    ['a fractional Buy Point price', 100, trade(1.5, 200)],
    ['a Profit that is not positive', 100, trade(100, 100)],
  ])('throws for %s', (_case, fundsCents, badTrade) => {
    expect(() => calculateTradeOutcome(fundsCents, badTrade)).toThrow(
      RangeError,
    );
  });
});
