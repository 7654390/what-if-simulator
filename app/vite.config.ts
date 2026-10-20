import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Das Cockpit importiert die Engine direkt aus ../src, ohne Umweg über dist/.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  worker: { format: 'es' },
  build: { target: 'es2022' },
});
