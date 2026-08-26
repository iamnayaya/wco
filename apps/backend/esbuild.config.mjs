import { build } from 'esbuild';

const isProd = process.env.NODE_ENV === 'production';

/**
 * Bundler strategy:
 *  - @wco/* workspace packages are pure TypeScript (main: src/index.ts), so
 *    they MUST be bundled — Node cannot require .ts at runtime.
 *  - @prisma/client stays external: it resolves query engine binaries from
 *    node_modules at runtime and must not be inlined.
 */
await build({
  entryPoints: ['src/main.ts', 'src/worker.ts'],
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  sourcemap: !isProd,
  minify: isProd,
  metafile: true,
  logLevel: 'info',
  external: ['@prisma/client'],
  define: {
    'process.env.NODE_ENV': `"${process.env.NODE_ENV ?? 'production'}"`,
  },
});
