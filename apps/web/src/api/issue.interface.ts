/** One thing wrong with a value, as both zod and `ProblemDetails` report it. */
export interface Issue {
  readonly path: readonly PropertyKey[];
  readonly message: string;
}
