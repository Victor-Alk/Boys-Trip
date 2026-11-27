import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';
import { destinationsPlugin } from './vite-plugins/destinations';

/** Ship MapLibre's worker and shared chunk unmodified (re-bundling the worker breaks it). */
function maplibreWorkerAssets(): Plugin {
  return {
    name: 'maplibre-worker-assets',
    apply: 'build',
    generateBundle() {
      for (const f of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) {
        this.emitFile({ type: 'asset', fileName: `vendor/maplibre/${f}`, source: readFileSync(`node_modules/maplibre-gl/dist/${f}`, 'utf8').replace(/\n\/\/# sourceMappingURL=.*$/m, '') });
      }
    },
  };
}

// Relative base + hash routing: the same build works at https://USER.github.io/REPO/ and locally.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), destinationsPlugin(), maplibreWorkerAssets()],
  build: { target: 'es2022', chunkSizeWarningLimit: 2000, sourcemap: false },
  optimizeDeps: { exclude: ['maplibre-gl'] },
  server: { port: 5173 },
  preview: { port: 4173 },
});
