import { defineConfig } from '@playwright/test'

const port = process.env.VIEWER_TEST_PORT ?? '4174'
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './tests',
  use: { baseURL, browserName: 'chromium' },
  webServer: {
    command: `pnpm exec vite preview --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI && !process.env.VIEWER_TEST_PORT,
  },
})
