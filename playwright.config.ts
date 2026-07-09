import { defineConfig } from "@playwright/test";
import { execSync } from "child_process";

function findChromium(): string | undefined {
  const envPath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  if (envPath) return envPath;
  try {
    return execSync("which chromium 2>/dev/null || which chromium-browser 2>/dev/null || which google-chrome 2>/dev/null", { encoding: "utf8" }).trim() || undefined;
  } catch {
    return undefined;
  }
}

const chromiumPath = findChromium();

export default defineConfig({
  testDir: "./tests",
  timeout: 90_000,
  retries: 1,
  reporter: "list",
  use: {
    baseURL: process.env.TEST_BASE_URL || "http://localhost:5000",
    viewport: { width: 402, height: 874 },
    headless: true,
    launchOptions: {
      executablePath: chromiumPath,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    },
  },
  projects: [
    {
      name: "chromium",
    },
  ],
});
