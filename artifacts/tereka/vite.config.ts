import path from 'node:path';
import fs from 'node:fs';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

function mirrorDistPlugin(): Plugin {
  return {
    name: 'mirror-dist-to-root',
    closeBundle() {
      const localDist = path.resolve(import.meta.dirname, 'dist');
      const rootDist = path.resolve(import.meta.dirname, '..', '..', 'dist');

      if (fs.existsSync(localDist)) {
        if (fs.existsSync(rootDist)) {
          fs.rmSync(rootDist, { recursive: true, force: true });
        }
        fs.mkdirSync(rootDist, { recursive: true });
        fs.cpSync(localDist, rootDist, { recursive: true });
        console.log(`[Tereka Vite] Successfully mirrored build output from ${localDist} to ${rootDist}`);
      }
    },
  };
}

const rawPort = process.env.PORT || '5180';
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH || '/';

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    mirrorDistPlugin(),
    ...(process.env.NODE_ENV !== 'production' &&
    process.env.REPL_ID !== undefined
      ? [
          runtimeErrorOverlay(),
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, '..'),
            }),
          ),
          await import('@replit/vite-plugin-dev-banner').then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: false,
    host: '127.0.0.1',
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5050',
        changeOrigin: true,
      },
    },
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: '127.0.0.1',
    allowedHosts: true,
  },
});