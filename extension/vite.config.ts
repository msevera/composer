import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        'universal-injector': path.resolve(__dirname, 'src/content-scripts/universal-injector.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'universal-injector') {
            return 'content-scripts/[name].js';
          }
          return 'assets/[name]-[hash].js';
        },
      },
    },
  },
});
