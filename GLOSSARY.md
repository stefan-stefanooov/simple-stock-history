# Simple Stock History

Answers one question about a single share's known price history: within a chosen time slice, when should you have bought and sold to make the most profit?

## Language

### Data

**Share**:
The single, fictional stock (ticker `ACME`) whose price history the service holds.
_Avoid_: Stock, ticker, symbol (as the name of the concept)

**Price History**:
The complete, static record of the Share's price, one Price Point for every second of the Data Period, with no gaps.
_Avoid_: Dataset, time series, feed

**Data Period**:
The fixed range, known in advance, that the Price History covers: all of November 2025, UTC.
_Avoid_: Range, window, history period

**Price Point**:
The Share's price at one specific second.
_Avoid_: Tick, sample, quote, candle

### Querying

**Time Slice**:
The range a client asks about, given by a start and an end second, both included, lying within the Data Period.
_Avoid_: Query range, window, interval, period

**Trade**:
A Buy Point paired with a later Sell Point, both inside the same Time Slice.
_Avoid_: Transaction, position, deal

**Buy Point**:
The second (and its price) at which a Trade buys the Share.
_Avoid_: Entry, buy time (as separate from its price)

**Sell Point**:
The second (and its price) at which a Trade sells the Share; always strictly after the Buy Point.
_Avoid_: Exit, sell time (as separate from its price)

**Profit**:
The Sell Point's price minus the Buy Point's price, per share.
_Avoid_: Gain, return, spread

**Best Trade**:
The Trade in a Time Slice with the highest Profit. On ties, the one with the earliest Buy Point wins; if still tied, the one with the earliest Sell Point (the shortest) wins.
_Avoid_: Optimal trade, solution, answer

**No Profitable Trade**:
The outcome when no Trade in the Time Slice has a Profit above zero.
_Avoid_: Empty result, no solution

### Presentation

**Available Funds**:
The maximum amount the user is willing to spend on buying the Share, entered in the UI.
_Avoid_: Budget, balance, capital
