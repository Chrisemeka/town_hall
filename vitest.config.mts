import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

// Server actions run in Node, not a browser, and they import through the same
// "@/..." alias the app uses — so the alias has to be repeated here or every
// import in a test resolves to nothing.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["**/__tests__/**/*.test.ts", "**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**", "scripts/**"],
  },
})
