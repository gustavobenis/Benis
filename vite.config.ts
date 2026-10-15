import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      output: { manualChunks: { babylon: ['@babylonjs/core'] } },
    },
  },
  test: { include: ['tests/**/*.test.ts'] },
});
