#!/bin/bash
# Run tests with ESM support

# Set Node options for ESM
export NODE_OPTIONS="--experimental-vm-modules --no-warnings"

# Run Jest with ESM support
npx jest --experimental-vm-modules --config tests/jest.config.js "$@"
