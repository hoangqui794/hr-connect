import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    exclude: [...configDefaults.exclude, 'e2e/**', '.kilo/**'],
    clearMocks: true,
    restoreMocks: true,
    css: false,
    testTimeout: 30000,
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      include: ['src/services/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/**/*.d.ts'],
      reporter: ['text', 'html', 'json-summary'],
      thresholds: {
        lines: 50,
        functions: 50,
        branches: 60,
        statements: 50,
      },
    },
  },
});
