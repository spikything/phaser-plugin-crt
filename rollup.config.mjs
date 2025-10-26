import typescript from "@rollup/plugin-typescript";

/** @type {import('rollup').RollupOptions[]} */
export default [
  {
    input: "src/index.ts",
    output: [
      { file: "dist/phaser-plugin-crt.esm.js", format: "esm", sourcemap: true },
      { file: "dist/phaser-plugin-crt.umd.js", format: "umd", name: "PhaserPluginCRT", sourcemap: true, globals: { phaser: "Phaser" } }
    ],
    external: ["phaser"],
    plugins: [
      typescript({ tsconfig: "./tsconfig.json", declaration: true, declarationDir: "dist", rootDir: "src" })
    ]
  }
];
