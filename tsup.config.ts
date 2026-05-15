import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: {
      'cli-exports/index': 'src/index.ts',
    },
    format: ['cjs'],
    dts: true,
    clean: true,
    sourcemap: false,
    target: 'node16',
  },
  {
    entry: {
      'esm/index': 'src/runtime/index.ts',
    },
    format: ['esm'],
    dts: true,
    clean: false,
    sourcemap: false,
    target: 'es2018',
    outExtension: () => ({ js: '.mjs' }),
  },
]);

