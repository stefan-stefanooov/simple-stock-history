/** Options every request accepts. */
export interface RequestOptions {
  /**
   * Cancels the request. The promise then rejects with the signal's reason
   * (an `AbortError` by default), never with an {@link ApiError}.
   */
  signal?: AbortSignal;
}
