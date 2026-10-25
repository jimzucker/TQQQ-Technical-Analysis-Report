// Browser tests for the page (docs/). Run with: npx playwright test
// The page is served as static files by tests/browser/serve.js, the way GitHub Pages serves it.
const { defineConfig, devices } = require("@playwright/test");

const PORT = 8123;
module.exports = defineConfig({
  testDir: "tests/browser",
  timeout: 30000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: `http://127.0.0.1:${PORT}/`, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"] }, testMatch: /(layout|rendering)\.spec\.js/ },
    // Safari's engine (WebKit), on a Mac and on an iPhone
    { name: "safari", use: { ...devices["Desktop Safari"] } },
    { name: "iphone", use: { ...devices["iPhone 15"] }, testMatch: /(layout|rendering)\.spec\.js/ },
  ],
  webServer: {
    command: `node tests/browser/serve.js ${PORT}`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env.CI,
  },
});
