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
echo "  Service Suite Verification"
echo "══════════════════════════════════════"

echo ""
echo "── nginx service ────────────────────"
check "nginx is active"                  "systemctl is-active nginx"
check "nginx is enabled"                 "systemctl is-enabled nginx"
check "nginx is listening on port 80"    "ss -tlnp | grep -q ':80'"

echo ""
echo "── idempotency ──────────────────────"
echo "  (re-running — should be no-op)"
dotts apply /home/testuser/service.ts
check "nginx still active after re-run"  "systemctl is-active nginx"

echo ""
echo "══════════════════════════════════════"
echo "  Results: ${PASS} passed / ${FAIL} failed"
echo "══════════════════════════════════════"
echo ""
[ "$FAIL" -eq 0 ] || exit 1
