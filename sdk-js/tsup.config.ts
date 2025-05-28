import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  bundle: true,
  skipNodeModulesBundle: true,
  splitting: true,
  clean: true,
  minify: true,
  sourcemap: true,
});
