import { defineConfig } from 'vite';

export default defineConfig({
  // Caminhos relativos: o mesmo build funciona na raiz de um domínio e em subpastas (GitHub Pages, Netlify, Vercel…)
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      output: { manualChunks: { babylon: ['@babylonjs/core'] } },
    },
  },
  test: { include: ['tests/**/*.test.ts'] },
});
