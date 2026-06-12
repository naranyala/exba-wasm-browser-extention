import { defineConfig } from '@rsbuild/core';
import fs from 'fs';
import path from 'path';
import { pluginWebExtension } from 'rsbuild-plugin-web-extension';

const targetBrowser = process.env.BROWSER || 'chrome';

function patchManifestPaths(manifest: any) {
  const fixPath = (p: string) =>
    p?.replace(/^\.\/src\//, '').replace(/\.ts$/, '.js');

  if (manifest.background?.service_worker) {
    manifest.background.service_worker = fixPath(
      manifest.background.service_worker,
    );
  }
  if (manifest.side_panel?.default_path) {
    manifest.side_panel.default_path = fixPath(
      manifest.side_panel.default_path,
    );
  }
  if (manifest.content_scripts) {
    for (const cs of manifest.content_scripts) {
      if (cs.js) {
        cs.js = cs.js.map(fixPath);
      }
    }
  }
  if (manifest.web_accessible_resources) {
    for (const war of manifest.web_accessible_resources) {
      if (war.resources) {
        war.resources = war.resources.map((r: string) =>
          r.replace(/^\.\/src\//, ''),
        );
      }
    }
  }
  return manifest;
}

export default defineConfig({
  dev: {
    writeToDisk: true,
  },
  performance: {
    chunkSplit: {
      strategy: 'all-in-one',
    },
  },
  plugins: [
    pluginWebExtension({
      manifest: {
        manifest_version: 3,
        name: 'Unified Rust-WASM Extension Starter',
        version: '1.0.0',
        description:
          'A unified Manifest V3 extension boilerplate demonstrating Web Components, Rust-WASM, Sidepanels, Alarms, Offscreen DOM, and DNR network filtering.',
        permissions: [
          'storage',
          'activeTab',
          'scripting',
          'sidePanel',
          'offscreen',
          'alarms',
          'declarativeNetRequest',
          'contextMenus',
          'bookmarks',
          'history',
          'cookies',
        ],
        host_permissions: ['<all_urls>'],
        background: {
          service_worker: './src/background.ts',
          type: 'module',
        },
        action: {
          default_title: 'Toggle EXBA Panel',
        },
        side_panel: {
          default_path: 'sidepanel.html',
        },
        declarative_net_request: {
          rule_resources: [
            {
              id: 'ruleset_1',
              enabled: true,
              path: 'rules.json',
            },
          ],
        },
        commands: {
          'toggle-exba-panel': {
            suggested_key: {
              default: 'Ctrl+Shift+Y',
              mac: 'MacCtrl+Shift+Y',
            },
            description: 'Toggle the EXBA Panel',
          },
        },
        web_accessible_resources: [
          {
            resources: [
              'popup.html',
              '*.js',
              '*.css',
              '*.wasm',
              'wasm/pkg/*',
              'static/wasm/*',
            ],
            matches: ['<all_urls>'],
          },
        ],
        content_scripts: [
          {
            matches: ['<all_urls>'],
            js: ['./src/content.ts'],
          },
        ],
        content_security_policy: {
          extension_pages:
            "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://unpkg.com https://*.tile.openstreetmap.org; object-src 'none'",
        },
        ...(targetBrowser === 'firefox' && {
          browser_specific_settings: {
            gecko: {
              id: 'exba-wasm-extension@starter.com',
              strict_min_version: '109.0',
            },
          },
        }),
      },
    }),
    {
      name: 'patch-manifest',
      setup(api) {
        const patch = () => {
          const dist = path.resolve(`dist/${targetBrowser}`);
          const manifestPath = path.join(dist, 'manifest.json');
          if (!fs.existsSync(manifestPath)) return;
          let manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
          manifest = patchManifestPaths(manifest);
          manifest.options_page = 'options.html';
          fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
          console.log('Manifest patched');
        };
        api.onAfterBuild(patch);
        api.onDevCompileDone(patch);
      },
    },
  ],
  source: {
    define: {
      'chrome.runtime.id': JSON.stringify('build-mock'),
    },
    entry: {
      popup: './src/popup.ts',
      options: './src/options.ts',
      sidepanel: './src/sidepanel.ts',
      offscreen: './src/offscreen.ts',
      content: './src/content.ts',
    },
  },
  output: {
    distPath: {
      root: `dist/${targetBrowser}`,
    },
    filenameHash: false,
    copy: [
      { from: './wasm/pkg', to: 'wasm/pkg' },
      { from: './public/styles.css', to: 'styles.css' },
      { from: './public/rules.json', to: 'rules.json' },
      { from: './public/popup.html', to: 'popup.html' },
      { from: './public/options.html', to: 'options.html' },
      { from: './public/sidepanel.html', to: 'sidepanel.html' },
      { from: './public/offscreen.html', to: 'offscreen.html' },
      { from: './node_modules/sql.js/dist/sql-wasm.wasm', to: 'sql-wasm.wasm' },
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
