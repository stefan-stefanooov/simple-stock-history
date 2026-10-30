import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    ignores: ['**/out-tsc'],
  },
  {
    // ADR-0001: the Price History must come from the seed alone.
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message:
            'The Price History must be reproducible from its seed (ADR-0001): use the seeded mulberry32 PRNG instead of Math.random.',
        },
      ],
    },
  },
];
