import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { cpSync } from 'node:fs'
import { resolve } from 'node:path'

function copyDataAssets() {
  return {
    name: 'copy-home-helper-data',
    writeBundle() {
      cpSync(resolve('assets/data'), resolve('dist/assets/data'), { recursive: true })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? './' : '/',
  plugins: [preact(), copyDataAssets()],
}))
