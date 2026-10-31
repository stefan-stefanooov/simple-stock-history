import { ApiError } from '../api/api-client';

/** Shown for a failure that is not an {@link ApiError}, i.e. a bug. */
export const UNEXPECTED_ERROR_MESSAGE =
  'Something unexpected went wrong. Please try again.';

/**
 * A message for the user about why a request failed. An {@link ApiError}
 * already carries one; anything else is a bug, so it is logged for whoever
 * debugs it and the user gets a generic message.
 */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  console.error(error);
  return UNEXPECTED_ERROR_MESSAGE;
}
