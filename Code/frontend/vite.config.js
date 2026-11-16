import { resolve } from 'node:path';
import { defineConfig, searchForWorkspaceRoot } from 'vite';

export default defineConfig({
  server: {
    fs: {
      allow: [searchForWorkspaceRoot(import.meta.dirname), resolve(import.meta.dirname, '../shared')],
    },
    proxy: {
      '/api': 'http://127.0.0.1:3000',
    },
  },
});
