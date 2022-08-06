import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import postcss from "rollup-plugin-postcss";
import dts from "rollup-plugin-dts";
import {terser} from "rollup-plugin-terser";
import peerDepsExternal from "rollup-plugin-peer-deps-external";

const pkg = require("./package.json");

export default [
  {
    input:   "src/index.ts",
    output:  [
      {
        file:      pkg.main,
        format:    "cjs",
        sourcemap: true,
      },
      {
        file:      pkg.module,
        format:    "esm",
        sourcemap: true,
      },
      {
        file:      pkg.umd,
        format:    "umd",
        name:      pkg.name.replace(/^@noxy\//, ""),
        sourcemap: true,
      },
    ],
    plugins: [
      peerDepsExternal(),
      resolve(),
      commonjs(),
      typescript({tsconfig: "./tsconfig.json"}),
      postcss(),
      terser(),
    ],
  },
  {
    input:    "dist/esm/index.d.ts",
    output:   [{file: "dist/types/index.d.ts", format: "esm"}],
    plugins:  [dts()],
    external: [/\.css$/],
  },
];
