import { defineConfig } from 'vite';
import { resolve } from 'path';
import { cpSync, mkdirSync } from 'fs';

export default defineConfig({
  build: {
    outDir: 'dist',
    cssMinify: true,
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
    },
  },
  plugins: [
    {
      name: 'copy-js-files',
      closeBundle() {
        // Copy JS files to dist as-is (global scope scripts, not ES modules)
        mkdirSync(resolve(__dirname, 'dist/js'), { recursive: true });
        cpSync(resolve(__dirname, 'js'), resolve(__dirname, 'dist/js'), { recursive: true });
      }
    }
  ],
});
