import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { name: 'auth', include: ['src/**/*.test.ts'], testTimeout: 15_000 }
})
