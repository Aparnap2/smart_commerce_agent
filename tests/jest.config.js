/**
 * Test Configuration
 * Uses Docker services: postgres (5432), redis (6379), ollama (11434)
 */

export default {
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/*.test.{js,ts}'],
  testPathIgnorePatterns: ['/node_modules/'],
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
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        target: 'ES2022',
        module: 'Node16',
        esModuleInterop: true,
        strict: false,
        skipLibCheck: true,
        allowJs: true,
        moduleResolution: 'node16',
      }
    }]
  },
  transformIgnorePatterns: [
    'node_modules/(?!(zod)/)'
  ]
};
