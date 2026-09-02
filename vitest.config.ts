import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

// 独立的 Vitest 配置：不影响 vite.config.ts，仅为单测/系统测提供 jsdom 环境。
// 保留与 vite.config.ts 一致的 `@` -> ./src 别名，便于测试代码复用业务模块。
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/__tests__/setup.ts"],
  },
});
