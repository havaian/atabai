import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  base: '/',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    host: '0.0.0.0', // Allow external connections
    port: 7777,
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      'engage.uz',
      '.engage.uz' // Allow subdomains too
    ],
    // If you want to allow all hosts (less secure):
    // allowedHosts: 'all'
  },
})