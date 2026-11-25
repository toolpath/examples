import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => ({
  server: {
    proxy: {
      // An API key only answers the browser origins it allows, so the dev server makes the calls.
      '/v1': {
        target: loadEnv(mode, process.cwd()).VITE_TOOLPATH_API_URL,
        changeOrigin: true,
      },
    },
  },
}))
