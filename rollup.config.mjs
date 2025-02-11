import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import shebang from 'rollup-plugin-shebang-bin'

/** @type {import('rollup').RollupOptions} */
const baseConfig = {
  output: {
    dir: 'dist',
    format: 'esm'
  },
  plugins: [
    nodeResolve(),
    typescript({ tsconfig: './tsconfig.json' }),
    shebang({ include: "src/clientApp.ts" }),
  ],
  external: id => /node_modules/.test(id)
};

export default [
  {
    ...baseConfig,
    input: 'src/clientApp.ts'
  },
  {
    ...baseConfig,
    input: 'src/serverStatus.ts',
  }
];
