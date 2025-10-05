#!/bin/bash
# E2E Test Runner - Self-contained tests with automatic cleanup

set -e  # Exit on error

echo "🎭 Running Playwright E2E tests..."
echo "   Tests create their own data and clean up afterward"
echo "   (No database resets needed!)"
echo ""

pnpm test:playwright

exit $?
