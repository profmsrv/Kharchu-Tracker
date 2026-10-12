import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import pwa from './src/pwa.config.js'

export default defineConfig({
  plugins: [react(), VitePWA(pwa)],
  server: {
    host: '0.0.0.0',
    port: 3333,
  },
  preview: {
    host: '0.0.0.0',
    port: 3333,
  },
})