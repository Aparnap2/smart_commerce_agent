import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3001',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    fixturesFolder: 'cypress/fixtures',
    screenshotsFolder: 'cypress/screenshots',
    videosFolder: 'cypress/videos',
    video: true,
    screenshotOnRunFailure: true,
    // Timeouts optimized for mocked tests (faster than real LLM calls)
    defaultCommandTimeout: 10000,
    responseTimeout: 15000,
    pageLoadTimeout: 30000,
    requestTimeout: 10000,
    retries: {
      runMode: 1,
      openMode: 0,
    },
    // Exclude mocked tests from run mode by default (run separately)
    excludeSpecPattern: [],
    env: {
      CYPRESS: 'true', // Enable test mode in the app
    },
    setupNodeEvents(on, config) {
      // Set environment variable for Next.js to detect Cypress
      process.env.CYPRESS = 'true'
      
      on('task', {
        log(message: string) {
          console.log(message)
          return null
        },
      })
      return config
    },
  },
  // Component testing config (if needed)
  component: {
    devServer: {
      framework: 'next',
      bundler: 'webpack',
    },
  },
})
