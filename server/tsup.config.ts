import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    main: "src/index.ts",
    "cli/seed": "src/cli/seed.ts",
  },
  format: ["esm"],
  target: "node24",
  platform: "node",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  noExternal: ["@unah-red-tutores/shared"],
});
