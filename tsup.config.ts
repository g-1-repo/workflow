import { defineConfig } from 'tsup'

export default defineConfig([
  // Library build
  {
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    clean: true,
    sourcemap: true,
    minify: false,
    target: 'node18',
    external: ['listr2', 'commander', 'chalk', 'ora', 'enquirer', 'execa', 'simple-git'],
  },
  // CLI build
  {
    entry: ['src/cli.ts'],
    format: ['cjs'],
    clean: false,
    sourcemap: true,
    minify: false,
    target: 'node18',
    external: ['listr2', 'commander', 'chalk', 'ora', 'enquirer', 'execa', 'simple-git'],
  },
])
