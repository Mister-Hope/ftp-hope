import pkg from "./package.json";
import json from "@rollup/plugin-json";
import typescript from "@rollup/plugin-typescript";
import dts from "rollup-plugin-dts";

export default [
  {
    input: "./src/index.ts",
    output: [{ file: pkg.main, format: "cjs", sourcemap: true }],
    plugins: [json(), typescript()],
  },
  {
    input: "./src/index.ts",
    output: [{ file: pkg.module, format: "esm", sourcemap: true }],
    plugins: [json(), typescript()],
  },
  {
    input: "./src/index.ts",
    output: [{ file: pkg.types, format: "esm", sourcemap: true }],
    plugins: [dts()],
  },
];
