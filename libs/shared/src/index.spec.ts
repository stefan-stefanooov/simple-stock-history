import { z } from 'zod';
import * as contract from './index.js';

// Swagger (nestjs-zod) is generated from these schemas, so each must convert
// to JSON Schema for both requests (input) and responses (output).
describe('JSON Schema for the API docs', () => {
  const schemas = Object.entries<unknown>(contract).filter(
    (entry): entry is [string, z.ZodType] => entry[1] instanceof z.ZodType,
  );

  it('covers every exported schema', () => {
    expect(schemas.map(([name]) => name).sort()).toEqual([
      'BestTradeQuerySchema',
      'BestTradeResponseSchema',
      'CurrencySchema',
      'EpochSecondsParamSchema',
      'EpochSecondsSchema',
      'PeriodResponseSchema',
      'PricePointSchema',
      'ProblemDetailsSchema',
      'ShareSchema',
      'TradeSchema',
      'ValidationIssueSchema',
    ]);
  });

  it.each(schemas)('converts %s', (_, schema) => {
    expect(() => z.toJSONSchema(schema, { io: 'input' })).not.toThrow();
    expect(() => z.toJSONSchema(schema, { io: 'output' })).not.toThrow();
  });

  it('documents from and to as digit strings in the query', () => {
    const { properties } = z.toJSONSchema(contract.BestTradeQuerySchema, {
      io: 'input',
    });
    expect(properties).toEqual({
      from: expect.objectContaining({ type: 'string', pattern: '^[0-9]+$' }),
      to: expect.objectContaining({ type: 'string', pattern: '^[0-9]+$' }),
    });
  });
});
