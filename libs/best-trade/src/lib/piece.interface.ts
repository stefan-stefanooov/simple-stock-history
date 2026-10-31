/**
 * A run of consecutive Price Points (a partial hour, a whole hour or several
 * hours joined), reduced to what joining it with its neighbours needs. Every
 * field is a position in the Price History.
 */
export interface Piece {
  /** The piece's earliest lowest price. */
  lowest: number;
  /** The piece's earliest highest price. */
  highest: number;
  /** Buy Point of the piece's own Best Trade, −1 for No Profitable Trade. */
  buy: number;
  /** Sell Point of the piece's own Best Trade, −1 for No Profitable Trade. */
  sell: number;
}
