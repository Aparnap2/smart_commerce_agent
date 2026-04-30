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
    environment: 'jsdom',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx', 'lib/**/__tests__/**/*.test.ts', 'lib/**/__tests__/**/*.test.tsx', '__tests__/components/**/*.test.tsx', '__tests__/pages/**/*.test.tsx', 'prisma/tests/**/*.test.ts'],
    globals: true,
    setupFiles: ['./tests/setup-env.ts'],
  },
});
