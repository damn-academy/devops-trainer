import { feedbackPlugin } from './src/engine/feedback/vite-plugin.ts';
import { defineConfig } from 'vitest/config';
import { manifestPlugin } from './src/core/manifest-plugin.ts';
import { pwaPlugin } from './src/engine/pwa/vite-plugin.ts';
import { publicRawPlugin } from './src/core/public-raw-plugin.ts';

// Cross-origin isolation lets later engines (v86, the RV64 track) share memory
// between workers through SharedArrayBuffer. The production server must send
// the same two headers.
const isolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export default defineConfig({
  base: './',
  // virtual:dt-manifest: the light course manifest the home page paints from;
  // sw.js + manifest.webmanifest for offline use (design 09 §3.2).
  plugins: [feedbackPlugin(), publicRawPlugin(), manifestPlugin(), pwaPlugin()],
  server: { headers: isolation },
  preview: { headers: isolation },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // The lab definitions of the Linux block (~76 kB of exam and machine
        // data) stay out of the block chunk: they are only needed together
        // with the emulator UI, which already loads lazily.
        manualChunks(id: string) {
          if (id.endsWith('src/blocks/linux/reallab/labs.ts')) return 'linux-labs';
        },
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['tests/setup-registry.ts'],
  },
});
