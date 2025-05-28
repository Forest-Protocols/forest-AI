import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: false,
  bundle: true,
  skipNodeModulesBundle: false,
  splitting: false,
  clean: true,
  minify: true,
});
