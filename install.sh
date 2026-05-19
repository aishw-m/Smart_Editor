#!/bin/bash
cd "$(dirname "$0")"
# Clear half-finished extractions that cause ENOTEMPTY
find node_modules -maxdepth 1 -type d -name '.*' -exec rm -rf {} + 2>/dev/null
timeout 38 npm install --no-audit --no-fund --prefer-offline --ignore-scripts >/dev/null 2>&1
EXIT=$?
{
  echo "EXIT=$EXIT"
  echo "vitest: $(ls node_modules/.bin/vitest 2>/dev/null || echo MISSING)"
  echo "next: $(ls node_modules/.bin/next 2>/dev/null || echo MISSING)"
  echo "tsc: $(ls node_modules/.bin/tsc 2>/dev/null || echo MISSING)"
  echo "modules: $(ls node_modules 2>/dev/null | wc -l)"
  echo "next-pkg: $(test -f node_modules/next/package.json && echo OK || echo MISSING)"
  echo "vitest-pkg: $(test -f node_modules/vitest/package.json && echo OK || echo MISSING)"
} > /tmp/result.txt
