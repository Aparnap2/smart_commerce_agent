/**
 * Test Configuration
 * Uses Docker services: postgres (5432), redis (6379), ollama (11434)
 */

export default {
  testEnvironment: 'node',
  roots: ['<rootDir>/..'],
  testMatch: ['**/*.test.{js,ts}'],
  testPathIgnorePatterns: ['/node_modules/', '/tests/node_modules/', '/tests/e2e/', '/tests/unit/.*\\.test\\.tsx$'],
  moduleFileExtensions: ['js', 'ts', 'json'],
  collectCoverageFrom: [
    'lib/**/*.ts',
    '!lib/**/*.d.ts',
    'app/**/*.tsx',
    '!app/**/*.test.*'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  testTimeout: 30000,
  verbose: true,
  preset: 'ts-jest/presets/default-esm',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        target: 'ES2022',
        module: 'ESNext',
        esModuleInterop: true,
        strict: false,
        skipLibCheck: true,
        allowJs: true,
        moduleResolution: 'node',
      }
    }]
  },
  transformIgnorePatterns: [
    'node_modules/(?!(zustand)/)'
  ],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  }
};
