import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

// Vite config - TypeScript version of the legacy vite.config.js. Behavior
// preserved exactly: same alias, same dev port, same allowed-hosts list. The
// `@` alias maps to src/ so absolute imports (`@/stores/auth`) keep working.
export default defineConfig({
  base: '/',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 7777,
    allowedHosts: ['localhost', '127.0.0.1', 'engage.uz', '.engage.uz'],
  },
});
