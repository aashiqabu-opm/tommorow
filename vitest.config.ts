import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

// Unit tests for pure / security-critical logic. Node environment; the `@`
// alias mirrors the app's tsconfig path so tests import modules the same way.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': resolve(__dirname, '.') },
  },
})
