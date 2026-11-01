# lint-rules

The repo's own ESLint rules. The root `eslint.config.mjs` registers them as the `local` plugin.

- `local/one-interface-per-file`: every interface lives in its own `<kebab-name>.interface.ts` file (`interface TradePositions` → `trade-positions.interface.ts`), and that file holds only the interface and its imports. A React component's props interface (`*Props` in a `.tsx` file) is exempt and stays next to its component. Type aliases are not checked.

Run `nx test lint-rules` to test the rules with ESLint's `RuleTester`.
