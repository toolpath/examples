import path from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The add-in serves the build from http://localhost:47831, and the dev server
// uses the same port, so one allowed origin on the API key covers both.
const PORT = 47831

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  base: './',
  server: { port: PORT, strictPort: true },
  preview: { port: PORT, strictPort: true },
  build: {
    outDir: path.resolve(import.meta.dirname, 'ToolpathCam/web'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 4096,
  },
})
