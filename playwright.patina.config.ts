import { defineConfig } from '@playwright/test'

// The patina against the Firebase emulators: two browsers see each other's wear.
export default defineConfig({
  testDir: 'e2e-patina',
  timeout: 90_000,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:5174' },
  // The emulators are started around this run by `firebase emulators:exec` (see the test:patina
  // script), which also shuts them down cleanly; Playwright only serves the app.
  webServer: {
    command: 'VITE_USE_EMULATORS=1 pnpm exec vite --port 5174 --strictPort',
    url: 'http://localhost:5174',
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [
    {
      name: 'phone',
      use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    },
  ],
})
