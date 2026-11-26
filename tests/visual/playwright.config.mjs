import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'catalogo.spec.mjs',
  outputDir: '../../.tmp/kja-051-visual',
  snapshotPathTemplate: '{testDir}/referencias/{projectName}/{arg}{ext}',
  updateSnapshots: 'none',
  workers: 1,
  reporter: 'list',
  expect: { toHaveScreenshot: { threshold: 0.05, maxDiffPixels: 0 } },
  use: {
    channel: process.env.KJA_BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : 'chromium'),
    launchOptions: { executablePath: process.env.KJA_BROWSER_EXECUTABLE || undefined },
    deviceScaleFactor: 1, reducedMotion: 'reduce', colorScheme: 'light', locale: 'es-PE'
  },
  projects: [[1280, 720], [1440, 900], [1920, 1080]].map(([width, height]) => ({
    name: width + 'x' + height, use: { viewport: { width, height } }
  }))
});
