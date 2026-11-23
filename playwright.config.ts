import { defineConfig } from '@playwright/test';

// Nodeの型パッケージを増やさず、ローカルで既存のChromiumを使う場合だけ指定できる。
declare const process: { env: { CI?: string; PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?: string } };

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  // Hosted runners share CPU rendering between WebGL contexts. Keep their pixel comparisons serial.
  workers: process.env.CI ? 1 : 2,
  timeout: 20_000,
  expect: { timeout: 5_000 },
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'mobile-390', testIgnore: '**/prototype3d.spec.ts', use: { viewport: { width: 390, height: 844 } } },
    { name: 'mobile-360', testIgnore: '**/prototype3d.spec.ts', use: { viewport: { width: 360, height: 640 } } },
    ...[{ width: 1280, height: 720 }, { width: 1920, height: 1080 }].map(viewport => ({
      name: 'desktop-' + viewport.width, testMatch: '**/prototype3d.spec.ts', timeout: 150_000,
      use: { viewport, isMobile: false, hasTouch: false, deviceScaleFactor: 1,
        trace: { mode: 'retain-on-failure' as const, screenshots: false, snapshots: true },
        launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
          args: ['--enable-unsafe-swiftshader'] } },
    })),
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
  },
});
