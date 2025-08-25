import { defineConfig } from 'vite';

export default defineConfig({
  base: '/Tally/',
  build: {
    outDir: 'dist-v2'
  },
  resolve: {
    alias: {
      './main': './main-v2',
      './api': './api-v2'
    }
  }
});