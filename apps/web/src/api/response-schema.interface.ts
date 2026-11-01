import type { Issue } from './issue.interface';

/**
 * The part of a zod schema the client needs, so the web app gets by without
 * depending on zod itself.
 */
export interface ResponseSchema<T> {
  safeParse(
    data: unknown,
  ):
    | { success: true; data: T }
    | { success: false; error: { issues: readonly Issue[] } };
}
