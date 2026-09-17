import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".",
  timeout: 300_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: { baseURL: "http://localhost:3000", trace: "off", video: "off" },
  reporter: "line",
});
