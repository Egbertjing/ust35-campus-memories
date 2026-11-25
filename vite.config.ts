import tailwindcss from '@tailwindcss/postcss';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// Static single-page build for GitHub Pages. BASE_PATH is set by the deploy
// workflow to "/<repo>/"; locally it defaults to "/".
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  css: { postcss: { plugins: [tailwindcss()] } },
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  build: { outDir: 'dist', chunkSizeWarningLimit: 2000 },
});
