import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  // Di CI: larang test.only yang tertinggal, dan satu percobaan ulang untuk runner yang lebih lambat.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: 'http://localhost:5199' },
  webServer: { command: 'npx vite --port 5199', url: 'http://localhost:5199', reuseExistingServer: true, timeout: 60000 },
});
