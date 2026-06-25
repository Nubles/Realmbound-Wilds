import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // Ensure asset paths are relative for GitHub Pages deployments
  build: {
    outDir: 'dist',
  }
});
