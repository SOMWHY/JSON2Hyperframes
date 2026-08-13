import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    j2hf: 'src/bin/j2hf.ts',
    generate: 'src/lib/generate.ts',
    hyperframes: 'src/lib/hyperframes.ts',
    init: 'src/lib/init.ts'
  },
  format: ['esm'],
  target: 'node18',
  clean: true,
  dts: false,
  minify: false,
  sourcemap: true,
  outDir: 'dist',
  shims: true,
});
