import * as shared from '@simple-stock-history/shared';

// Checks only that the workspace library resolves and loads under Jest, not
// any particular export, so it keeps passing as the contract in libs/shared grows.
describe('@simple-stock-history/shared', () => {
  it('can be imported by the API', () => {
    expect(Object.keys(shared).length).toBeGreaterThan(0);
  });
});
