import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { mkdirSync } from "node:fs";

// Keep worker scratch files inside the repository. The Windows app sandbox can
// deny atomic renames in the system temp directory used by Vitest's workers.
const testTemp = path.resolve(import.meta.dirname, "node_modules/.vitest-tmp");
mkdirSync(testTemp, { recursive: true });
process.env.TEMP = testTemp;
process.env.TMP = testTemp;

// 独立的 Vitest 配置：不影响 vite.config.ts，仅为单测/系统测提供 jsdom 环境。
// 保留与 vite.config.ts 一致的 `@` -> ./src 别名，便于测试代码复用业务模块。
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/__tests__/setup.ts"],
    pool: "threads",
    isolate: true,
    fileParallelism: false,
  },
});
