import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const PRODUCTION_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'none';";

function productionCspPlugin(): Plugin {
  return {
    name: 'vaultscrub-production-csp',
    apply: 'build',
    transformIndexHtml(html) {
      const metaTag = `<meta http-equiv="Content-Security-Policy" content="${PRODUCTION_CSP}" />`;
      return html.replace(/<head([^>]*)>/i, `<head$1>\n    ${metaTag}`);
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), productionCspPlugin()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.replace(/\\/g, '/');
          if (
            normalized.includes('/node_modules/react/') ||
            normalized.includes('/node_modules/react-dom/') ||
            normalized.includes('/node_modules/scheduler/')
          ) {
            return 'vendor-react';
          }
          if (normalized.includes('/node_modules/lucide-react/')) {
            return 'vendor-icons';
          }
          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'node',
  },
});
