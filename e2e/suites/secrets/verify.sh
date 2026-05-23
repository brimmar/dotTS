#!/bin/bash
# Secrets suite verification
# Tests: dotts secrets set, dotts secrets list, file with secret content
set -euo pipefail
PASS=0; FAIL=0
check() {
  local desc="$1" condition="$2"
  if eval "$condition" &>/dev/null; then echo "  ✓ $desc"; PASS=$((PASS+1))
  else echo "  ✗ $desc"; FAIL=$((FAIL+1)); fi
}

echo ""
echo "══════════════════════════════════════"
echo "  Secrets Suite Verification"
echo "══════════════════════════════════════"

echo ""
echo "── secrets CLI ──────────────────────"
check "master key file created"          "test -f $HOME/.dotts_key"
check "secrets.json created"             "test -f .dotts/secrets.json"
check "DB_PASSWORD listed"               "dotts secrets list | grep -q DB_PASSWORD"
check "API_KEY listed"                   "dotts secrets list | grep -q API_KEY"

echo ""
echo "── check command ────────────────────"
check "dotts check passes valid config"   "dotts check /home/testuser/secrets.ts"

echo ""
echo "── init command ─────────────────────"
check "dotts init creates project dir"    "test -f /tmp/dotts-init-test/dotts.ts"
check "init produces valid config"        "dotts check /tmp/dotts-init-test/dotts.ts"

echo ""
echo "── doctor command ───────────────────"
check "doctor runs without crashing"      "dotts doctor"
check "doctor detects git"               "dotts doctor 2>&1 | grep -q 'git found'"

echo ""
echo "── dry-run mode ─────────────────────"
check "dry-run produces output"           "dotts apply /home/testuser/secrets.ts --dry-run 2>&1 | grep -q 'DRY RUN'"
check "dry-run does not write files"      "! test -f /tmp/dotts-dryrun-should-not-exist.txt"

echo ""
echo "── cyclic dependency detection ──────"
check "cyclic dep throws an error"        "dotts apply /home/testuser/cyclic.ts 2>&1 | grep -iq 'cycl\\|circular\\|depend'"

echo ""
echo "══════════════════════════════════════"
echo "  Results: ${PASS} passed / ${FAIL} failed"
echo "══════════════════════════════════════"
echo ""
[ "$FAIL" -eq 0 ] || exit 1
