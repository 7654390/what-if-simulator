import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    lib: {
      entry: { index: 'src/index.ts', client: 'src/client.ts', worker: 'src/worker.ts' },
      formats: ['es'],
      fileName: (_format, name) => `${name}.js`,
    },
  },
});
