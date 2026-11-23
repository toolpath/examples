import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const target = loadEnv(mode, process.cwd()).VITE_TOOLPATH_API_URL
  return {
    plugins: [tailwindcss()],
    server: {
      // An API key only answers the browser origins it allows, so the dev server makes the calls.
      // Without a URL there are no uploads, and the samples need no API.
      proxy: target ? { '/v1': { target, changeOrigin: true } } : {},
    },
  }
})
