#!/bin/bash
# E2E Test Runner with smart database management

set -e  # Exit on error

# Check if we should reset the database
if [ "$1" = "--reset" ] || [ ! -f ".e2e-db-clean" ]; then
  echo "🔄 Resetting database for clean E2E test environment..."
  npx supabase db reset

  echo ""
  echo "⏳ Waiting for services to stabilize..."
  sleep 2

  # Mark database as clean
  touch .e2e-db-clean

  echo ""
  echo "✅ Database reset complete"
  echo ""
fi

echo "🎭 Running Playwright E2E tests..."
echo "   (Tests will clean up data they create)"
echo ""

pnpm test:playwright
EXIT_CODE=$?

# If tests pass, keep the clean marker. If they fail, remove it so next run resets.
if [ $EXIT_CODE -ne 0 ]; then
  rm -f .e2e-db-clean
  echo ""
  echo "⚠️  Tests failed - database will reset on next run"
fi

exit $EXIT_CODE
