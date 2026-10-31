const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');

module.exports = {
  output: {
    path: join(__dirname, 'dist'),
    clean: true,
    ...(process.env.NODE_ENV !== 'production' && {
      devtoolModuleFilenameTemplate: '[absolute-resource-path]',
    }),
  },
  // NxAppWebpackPlugin leaves only packages in the root node_modules external,
  // so with pnpm the api's own dependencies get bundled. pino must not be: it
  // starts transports (pino-pretty in development) in worker threads, loading
  // its worker files by path.
  externals: [
    {
      'nestjs-pino': 'commonjs nestjs-pino',
      pino: 'commonjs pino',
      'pino-http': 'commonjs pino-http',
    },
  ],
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/main.ts',
      tsConfig: './tsconfig.app.json',
      assets: ['./src/assets'],
      optimization: false,
      outputHashing: 'none',
      generatePackageJson: false,
      sourceMap: true,
      mergeExternals: true,
    }),
  ],
};
