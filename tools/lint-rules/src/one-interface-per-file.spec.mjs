import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { oneInterfacePerFile } from './one-interface-per-file.mjs';

const ruleTester = new RuleTester({
  languageOptions: { parser: tseslint.parser },
});

ruleTester.run('one-interface-per-file', oneInterfacePerFile, {
  valid: [
    {
      name: 'one interface in its own file, with imports',
      filename: 'lib/trade-positions.interface.ts',
      code: `import type { Price } from './price.interface.ts';
export interface TradePositions { buy: Price; sell: Price }`,
    },
    {
      name: 'a file without interfaces',
      filename: 'lib/hour-summaries.ts',
      code: `type Hour = number;
export const HOUR_LENGTH = 3600;`,
    },
    {
      name: 'acronyms in the name',
      filename: 'lib/http-client.interface.ts',
      code: 'export interface HTTPClient { get(url: string): void }',
    },
    {
      name: 'React props stay next to their component',
      filename: 'app/time-slice-picker.tsx',
      code: `export interface TimeSlicePickerProps { onChange: () => void }
export function TimeSlicePicker(props: TimeSlicePickerProps) { return null; }`,
    },
  ],
  invalid: [
    {
      name: 'file not named after its interface',
      filename: 'lib/best-trade.ts',
      code: 'export interface TradePositions { buy: number; sell: number }',
      errors: [{ messageId: 'fileName' }],
    },
    {
      name: 'two interfaces in one file',
      filename: 'lib/trade-positions.interface.ts',
      code: `export interface TradePositions { buy: number; sell: number }
export interface BestTradeSearch { find(): TradePositions | null }`,
      errors: [{ messageId: 'oneInterface' }],
    },
    {
      name: 'code next to the interface',
      filename: 'lib/piece.interface.ts',
      code: `export interface Piece { lowest: number }
export const NO_TRADE = -1;`,
      errors: [{ messageId: 'onlyTheInterface' }],
    },
    {
      name: 'an interface that is not exported counts too',
      filename: 'api/api-client.ts',
      code: `interface Issue { path: string }
export function fetchJson() {}`,
      errors: [{ messageId: 'fileName' }, { messageId: 'onlyTheInterface' }],
    },
    {
      name: 'a non-props interface in a .tsx file',
      filename: 'app/best-trade-result.tsx',
      code: `export interface QueryResult { ok: boolean }
export interface BestTradeResultProps { result: QueryResult }
export function BestTradeResult() { return null; }`,
      errors: [{ messageId: 'fileName' }, { messageId: 'onlyTheInterface' }],
    },
    {
      name: 'Props in a .ts file is not exempt',
      filename: 'lib/options.ts',
      code: 'export interface ButtonProps { label: string }',
      errors: [{ messageId: 'fileName' }],
    },
  ],
});
