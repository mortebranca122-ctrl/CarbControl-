import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    base: './',
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
        manifest: {
          id: './',
          name: 'CarbControl — Sukuna Edition',
          short_name: 'CarbControl',
          description:
            'Conheça seus alimentos. Registre seus carboidratos. Aplicativo offline de contagem de carboidratos e diário alimentar.',
          theme_color: '#0D0D0D',
          background_color: '#0D0D0D',
          display: 'standalone',
          orientation: 'any',
          start_url: './',
          scope: './',
          lang: 'pt-BR',
          icons: [
            {
              src: './pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: './pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: './pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,woff,woff2}'],
          maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
          type: 'module',
        },
      }),
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, 'dist');
          const srcAssets = path.resolve(__dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
        },
      },
      // Allows dist/index.html to be opened directly via file:// (double-click)
      // as well as any HTTP/HTTPS server (root or subpath).
      {
        name: 'file-protocol-compatible-html',
        apply: 'build',
        enforce: 'post' as const,
        transformIndexHtml(html: string): string {
          return html
            .replace(/<!--\s*DEV_FILE_REDIRECT_START\s*-->[\s\S]*?<!--\s*DEV_FILE_REDIRECT_END\s*-->/g, '')
            .replace(
              /<script\s+type="module"\s+crossorigin\s+src="([^"]+)"><\/script>/g,
              '<script defer src="$1"></script>'
            )
            .replace(
              /<link\s+rel="stylesheet"\s+crossorigin\s+href="([^"]+)">/g,
              '<link rel="stylesheet" href="$1">'
            )
            .replace(
              /<link\s+rel="manifest"\s+href="([^"]+)">/g,
              '<script>if(location.protocol!=="file:"){var l=document.createElement("link");l.rel="manifest";l.href="$1";document.head.appendChild(l);}</script>'
            );
        },
      },
    ],
    build: {
      rollupOptions: {
        output: {
          format: 'iife' as const,
          name: 'CarbControlApp',
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
