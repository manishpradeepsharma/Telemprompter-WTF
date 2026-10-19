import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://teleprompter.sharmacomputers.net',
  outDir: process.env.TELEPROMPTER_OUT_DIR ?? 'dist',
  integrations: [preact(), sitemap()],
  output: 'static',
  trailingSlash: 'never',
  server: {
    host: true,
    port: 4321,
  },
  build: {
    inlineStylesheets: 'auto',
  },
  vite: {
    server: {
      host: true,
      proxy: {
        '/api': 'http://127.0.0.1:4322',
        '/filestore': 'http://127.0.0.1:4322',
      },
    },
    build: {
      cssMinify: 'lightningcss',
    },
  },
});
