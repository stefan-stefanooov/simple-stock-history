import { z } from 'zod';

/** Media type of every error response (RFC 9457). */
export const PROBLEM_JSON_MEDIA_TYPE = 'application/problem+json';

/** One thing wrong with a request, as reported in `ProblemDetails.issues`. */
export const ValidationIssueSchema = z.object({
  path: z
    .array(z.union([z.string(), z.int()]))
    .describe('Where in the request the issue is, e.g. ["from"]'),
  message: z.string().describe('Human-readable description of the issue'),
});

export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;

/**
 * An error response body: RFC 9457 problem details, extended with the list
 * of validation issues for a rejected request.
 */
export const ProblemDetailsSchema = z.object({
  type: z
    .string()
    .describe(
      'URI reference identifying the problem type; "about:blank" when the HTTP status says it all',
    ),
  title: z
    .string()
    .describe('Short, human-readable summary of the problem type'),
  status: z.int().min(100).max(599).describe('HTTP status code'),
  detail: z
    .string()
    .optional()
    .describe('Human-readable explanation of this occurrence of the problem'),
  instance: z
    .string()
    .optional()
    .describe('URI reference identifying this occurrence of the problem'),
  issues: z
    .array(ValidationIssueSchema)
    .optional()
    .describe('Validation issues that made the request invalid'),
});

export type ProblemDetails = z.infer<typeof ProblemDetailsSchema>;
