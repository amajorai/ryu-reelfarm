import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const e2eDirectory = import.meta.dirname;
const appRoot = path.resolve(e2eDirectory, "..");
const baseURL = "http://127.0.0.1:4497";

export default defineConfig({
	testDir: e2eDirectory,
	testMatch: "reelfarm-companion.spec.ts",
	fullyParallel: false,
	workers: 1,
	reporter: "list",
	use: {
		...devices["Desktop Chrome"],
		baseURL,
		viewport: { width: 1600, height: 1050 },
	},
	webServer: {
		command:
			"bun run build && bun run vite --config e2e/vite.config.ts --host 127.0.0.1 --port 4497 --strictPort",
		cwd: appRoot,
		url: baseURL,
		reuseExistingServer: false,
		timeout: 120_000,
	},
});
