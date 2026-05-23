#!/bin/bash
set -euo pipefail
PASS=0; FAIL=0
check() {
  local desc="$1" condition="$2"
  if eval "$condition" &>/dev/null; then echo "  ✓ $desc"; PASS=$((PASS+1))
  else echo "  ✗ $desc"; FAIL=$((FAIL+1)); fi
}

echo ""
echo "══════════════════════════════════════"
echo "  System Suite Verification"
echo "══════════════════════════════════════"

echo ""
echo "── group ────────────────────────────"
check "dotts-testgroup exists"           "getent group dotts-testgroup"
check "dotts-tempgroup was removed"      "! getent group dotts-tempgroup"

echo ""
echo "── user ─────────────────────────────"
check "dotts-testuser exists"            "id dotts-testuser"
check "dotts-testuser has bash shell"    "getent passwd dotts-testuser | cut -d: -f7 | grep -q bash"
check "dotts-testuser home created"      "test -d /home/dotts-testuser"
check "dotts-testuser in testgroup"      "id -Gn dotts-testuser | grep -q dotts-testgroup"
check "dotts-tempuser was removed"       "! id dotts-tempuser"

echo ""
echo "── aptRepository ────────────────────"
check "dotts-test-repo.list exists"      "test -f /etc/apt/sources.list.d/dotts-test-repo.list"
check "repo file has correct URI"        "grep -q 'archive.ubuntu.com/ubuntu' /etc/apt/sources.list.d/dotts-test-repo.list"
check "repo file has universe component" "grep -q 'universe' /etc/apt/sources.list.d/dotts-test-repo.list"

echo ""
echo "── idempotency (re-run) ─────────────"
dotts apply /home/testuser/system.ts
check "group still exists after re-run"  "getent group dotts-testgroup"
check "user still exists after re-run"   "id dotts-testuser"
check "repo list still exists"           "test -f /etc/apt/sources.list.d/dotts-test-repo.list"

echo ""
echo "══════════════════════════════════════"
echo "  Results: ${PASS} passed / ${FAIL} failed"
echo "══════════════════════════════════════"
echo ""
[ "$FAIL" -eq 0 ] || exit 1
