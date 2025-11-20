// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react-swc'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    //pool: 'forks',
    //poolOptions: {
    //  forks: {
        // Force tests to run in single, persistent process so we don't grow old.
    //    singleFork: true, 
    //  },
    //},
    setupFiles: ['./src/tests/setup.ts'],
    globals: true,
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'src/tests/',
        'src/__tests__/**/*',
        'node_modules/',
        '**/*.d.ts',
        '**/*.config.*',
        'coverage/',
        'dist/'
      ]
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}) 

