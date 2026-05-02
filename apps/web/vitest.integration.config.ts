import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import path from 'path';

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      '@/lib': path.resolve(__dirname, './lib'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    globals: true,
    setupFiles: ['./tests/setup-env.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});