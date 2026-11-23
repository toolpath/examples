import { defineConfig } from '@playwright/test'

const port = process.env.VIEWER_TEST_PORT ?? '4175'
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './tests',
  // `*.test.ts` are Vitest's.
  testMatch: '**/*.spec.ts',
  use: { baseURL, browserName: 'chromium' },
  webServer: {
    command: `pnpm exec vite preview --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI && !process.env.VIEWER_TEST_PORT,
  },
})
