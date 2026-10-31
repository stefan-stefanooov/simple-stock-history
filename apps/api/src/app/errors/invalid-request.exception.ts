import { BadRequestException } from '@nestjs/common';
import type { ValidationIssue } from '@simple-stock-history/shared';

/** The `detail` of every 400 that lists validation issues. */
export const INVALID_REQUEST_DETAIL =
  'The request is invalid; see issues for what to fix.';

/**
 * A request that passed its schema but breaks a rule only the endpoint can
 * check, e.g. a Time Slice outside the Data Period. Answered like a schema
 * failure: 400 problem+json listing the `issues`.
 *
 * @example
 * throw new InvalidRequestException([
 *   { path: ['from'], message: 'Must lie within the Data Period' },
 * ]);
 */
export class InvalidRequestException extends BadRequestException {
  constructor(readonly issues: readonly ValidationIssue[]) {
    super(INVALID_REQUEST_DETAIL);
    this.name = 'InvalidRequestException';
  }
}
