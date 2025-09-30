import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  test: {
    // Environment
    environment: 'jsdom',

    // Setup files
    setupFiles: ['./tests/setup.ts'],

    // CRITICAL: Memory optimization settings
    // Limit parallel workers to prevent memory explosion
    maxWorkers: 2,  // Instead of 8-12 CPU cores
    minWorkers: 1,

    // Use forks for better memory isolation (not threads)
    pool: 'forks',
    poolOptions: {
      forks: {
        // Isolate each test file completely
        isolate: true,
        // Restart worker after processing files to release memory
        singleFork: false,
      }
    },

    // Test isolation and cleanup
    isolate: true,  // Run each test file in isolation
    clearMocks: true,  // Clear all mocks between tests
    restoreMocks: true,  // Restore original implementations
    mockReset: true,  // Reset mock state

    // Disable watch mode cache to prevent accumulation
    cache: false,

    // Timeouts
    testTimeout: 30000,  // 30s per test
    hookTimeout: 30000,  // 30s for beforeEach/afterEach

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',

      // Clean coverage directory before each run
      clean: true,

      // Exclude patterns
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/types.ts',
        '**/*.d.ts',
        '**/vite.config.ts',
        '**/vitest.config.ts'
      ],

      // Coverage thresholds
      thresholds: {
        global: {
          lines: 75,
          functions: 75,
          branches: 75,
          statements: 75
        }
      },

      // Memory optimization: Process coverage in smaller chunks
      all: false,  // Don't collect coverage for unused files
      skipFull: false,
    },

    // Reporter configuration
    reporters: ['default'],

    // Global setup/teardown
    globalSetup: [],
    globalTeardown: [],

    // File patterns
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: [
      'node_modules',
      'dist',
      '.idea',
      '.git',
      '.cache'
    ],

    // Performance optimizations
    // Disable sourcemap in tests for faster execution
    sourcemap: false,

    // Retry failed tests (helpful for flaky Supabase tests)
    retry: 1,

    // Bail on first test failure in CI (save resources)
    bail: process.env.CI ? 1 : 0,
  },
})