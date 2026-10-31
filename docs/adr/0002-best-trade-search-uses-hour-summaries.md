# Best Trade search uses hour summaries, baked into the image

A plain loop over a Time Slice reads up to 2,592,000 Price Points per query. Instead we split the Price History into hours. For each hour we keep an hour summary: its earliest lowest price, its earliest highest price and its own Best Trade. A query loops only over the partial hours at its two ends and joins the whole hours in between from their summaries. Any Time Slice then costs at most two hours of Price Points plus one summary per hour. The worst case measured about 0.4 ms, against about 6 ms for the plain loop. The Price History never changes, so the generator writes the hour summaries next to it at image build, pinned by their own committed sha256 (ADR-0001). Pods load them and do not rebuild them.

Joining two adjacent pieces of a Time Slice picks the best of three Trades:

- the left piece's Best Trade
- the right piece's Best Trade
- buying at the left piece's earliest lowest price and selling at the right piece's earliest highest price

Best means highest Profit, then earliest Buy Point, then earliest Sell Point. This keeps the Best Trade tie-break exact across hour boundaries.

## Considered Options

- **Loop over the Time Slice on every request**: rejected. It is the simplest option and needs no state, but a full Data Period took 6–10 ms on a dev machine (an estimated 15–30 ms on the lab node), and the cost grows with the Time Slice. It survives as the loop over the partial hours.
- **Segment tree down to single seconds**: rejected. Queries take about 1 µs, but it needs about 80 MB, eight times the Price History, for a gain no user can see.
- **Price History split into per-hour arrays, concatenated per query**: rejected. It copies the Price Points before looping over the same number of them, so it was slower than the plain loop at every Time Slice length, and it doubles memory.
- **Build the hour summaries at startup**: rejected, although each pod would spend only about 18 ms on it, about as long as reading and hashing the Price History. Since the data is static, the summaries are a fixed artifact of the release like the Price History itself. They are computed once per release, not once per pod, at the price of a second pinned file with its own binary format.

## Consequences

- **The summaries file is a contract.** The generator and the API both use `libs/best-trade` to build and read `<name>.hours.bin`: Int32 little-endian, 4 values per hour (lowest, highest, buy and sell positions, −1 for no Trade). The API finds it next to the Price History, so it needs no setting of its own. Changing the summary logic or the hour length changes the pinned sha256, which must be updated in the same PR.
- **The hour length is a parameter**: 3,600 seconds in production, 1–6 in tests. Short random series must cross hour boundaries, so the join is checked against a brute-force reference.
- **No Time Slice length limit is needed** because the worst case is bounded. Budget:
  - the search itself takes at most 1 ms for any Time Slice on a dev machine
  - 99% of `GET /api/v1/trades/best` requests take at most 50 ms server-side on the lab node
- **Revisit if the Data Period grows well beyond a month.** First add a day level: 24 hour summaries joined the same way. At a scale of years, also stop holding every Price Point in memory: keep only the summaries, and read the two partial hours from disk per query.
