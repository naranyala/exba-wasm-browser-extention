import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  dev: {
    writeToDisk: true,
  },
  source: {
    entry: {
      background: './src/background.ts',
      content: './src/content.ts',
      offscreen: './src/offscreen.ts',
      options: './src/options.ts',
      sidepanel: './src/sidepanel.ts',
      popup: './src/popup.ts',
    },
  },
  html: {
    template: ({ entryName }) => {
      const templates: Record<string, string> = {
        options: './public/options.html',
        sidepanel: './public/sidepanel.html',
        offscreen: './public/offscreen.html',
      };
      return templates[entryName] || './public/popup.html';
    },
  },
  output: {
    distPath: {
      root: 'dist',
    },
    filenameHash: false,
    copy: [
      { from: './wasm/pkg', to: 'wasm/pkg' },
      { from: './public/manifest.json', to: 'manifest.json' },
      { from: './public/styles.css', to: 'styles.css' },
      { from: './public/rules.json', to: 'rules.json' },
    ],
  },
  tools: {
    rspack: (config) => {
      config.output!.filename = '[name].js';
      config.output!.chunkFilename = '[name].js';
      return config;
    },
  },
});
