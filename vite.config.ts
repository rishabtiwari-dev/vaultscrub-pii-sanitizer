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
  test: {
    environment: 'node',
  },
});
