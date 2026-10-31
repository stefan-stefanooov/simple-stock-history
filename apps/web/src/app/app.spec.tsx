import { render, screen } from '@testing-library/react';

import App from './app';

describe('App', () => {
  it('renders the placeholder page', () => {
    render(<App />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Simple Stock History' }),
    ).toBeTruthy();
  });
});
