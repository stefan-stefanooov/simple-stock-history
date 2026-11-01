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
      // Nor @nestjs/swagger: it serves Swagger UI's files from the
      // swagger-ui-dist package's folder, found by path. Kept external, it
      // also does not bundle the class-validator and class-transformer
      // requires of its mapped types, which the API does not install.
      '@nestjs/swagger': 'commonjs @nestjs/swagger',
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
