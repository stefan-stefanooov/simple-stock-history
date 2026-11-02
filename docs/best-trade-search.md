# How the Best Trade search works

[← README](../README.md)

This page explains how a query finds the Best Trade. [ADR-0002](adr/0002-best-trade-search-uses-hour-summaries.md) records why hour summaries were chosen, and [the alternatives](best-trade-alternatives/README.md) shows the measurements. The code is in [`libs/best-trade`](../libs/best-trade/src/lib).

The API turns `from` and `to` into positions in the Price History (the Data Period's first second is position 0) and asks the search for the Best Trade between them, both included.

## 1. One pass over the Price Points

A Trade sells at some second. For that Sell Point, the best Buy Point is the lowest price before it. So a single pass is enough: remember the earliest lowest price seen so far, and at each second check whether selling there beats the best Trade so far.

```text
for each second i after the first:
  profit = price[i] − price[lowest]
  if profit > best profit:  best Trade = (lowest, i)
  if price[i] < price[lowest]:  lowest = i
```

The comparisons are strict (`>`, `<`), so on equal Profit the first Trade found stays. That gives the tie-break for free: earliest Buy Point, then earliest Sell Point.

This loop is `summarize` in [`piece.ts`](../libs/best-trade/src/lib/piece.ts). It also tracks the earliest highest price, which the next step needs. It reads every Price Point, so a whole month is 2.6 million of them.

## 2. Pieces and the join

`summarize` reduces any run of consecutive Price Points to a **piece** of four positions:

| Field     | Meaning                                                          |
| --------- | ---------------------------------------------------------------- |
| `lowest`  | earliest lowest price                                            |
| `highest` | earliest highest price                                           |
| `buy`     | Buy Point of the piece's Best Trade, −1 for No Profitable Trade  |
| `sell`    | Sell Point of the piece's Best Trade, −1 for No Profitable Trade |

Two adjacent pieces join into one piece without looking at their Price Points again. Every Trade in the joined piece is one of three kinds:

1. **Both points in the left piece**: the best of these is the left piece's Best Trade.
2. **Both points in the right piece**: the best is the right piece's Best Trade.
3. **Buy in the left, sell in the right**: the best buys at the left's lowest price and sells at the right's highest price.

The joined Best Trade is the best of these three: highest Profit, then earliest Buy Point, then earliest Sell Point. The joined `lowest` and `highest` are whichever side's is lower or higher, keeping the left one on a tie, so they stay the earliest. This is `join` in `piece.ts`.

## 3. A query

The Price History is cut into hours of 3,600 Price Points. Each hour's piece, its **hour summary**, is computed once at image build and loaded by the API (ADR-0002). A Time Slice then has three parts:

```text
Time Slice    |◀──────────────────────────────────────────────▶|
hours      [ ··|········ ][ ··········· ][ ··········· ][ ·····|·· ]
              partial hour  whole hour     whole hour    partial hour
              loop          summary        summary       loop
```

1. Loop over the partial hour at the start (`summarize`).
2. Join each whole hour's summary in order.
3. Loop over the partial hour at the end, and join it last.

So a query reads at most two hours of Price Points plus one summary per whole hour in between: about 15 µs for the whole month, against about 3 ms for the plain loop. If the Time Slice touches only one or two hours, there is nothing to join and the search just loops. This is `findBestTrade` in [`best-trade-search.ts`](../libs/best-trade/src/lib/best-trade-search.ts).

## A worked example

Hours of 4 Price Points (the tests use short hours too), Time Slice from position 1 to 10:

```text
position   0  1  2  3 |  4  5  6  7 |  8  9 10 11
price      5  3  6  4 |  7  2  2  8 |  4  9  4  1
slice         └──────────────────────────────┘
```

| Step                              | Piece  | `lowest` | `highest` | Best Trade            |
| --------------------------------- | ------ | -------- | --------- | --------------------- |
| Loop over positions 1–3           | start  | 1 (3)    | 2 (6)     | 1 → 2, +3             |
| Hour 4–7, from its summary        | right  | 5 (2)    | 7 (8)     | 5 → 7, +6             |
| Join: +3, +6, or cross 1 → 7 = +5 | joined | 5 (2)    | 7 (8)     | **5 → 7, +6** (right) |
| Loop over positions 8–10          | right  | 8 (4)    | 9 (9)     | 8 → 9, +5             |
| Join: +6, +5, or cross 5 → 9 = +7 | joined | 5 (2)    | 9 (9)     | **5 → 9, +7** (cross) |

The Best Trade buys at position 5 and sells at position 9 for +7. Positions 5 and 6 both cost 2; the earliest lowest price keeps the earlier Buy Point, as the tie-break requires.

## How it's checked

The tests compare the search with a brute-force reference that tries every pair of seconds, on 20,000 random Time Slices ([`best-trade-search.spec.ts`](../libs/best-trade/src/lib/best-trade-search.spec.ts)). The series are short and use few distinct prices, so Profit ties are common, and hour lengths of 1–6 put hour boundaries all through them.
