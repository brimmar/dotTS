#!/bin/bash
# Verification for the advanced E2E suite
set -euo pipefail

PASS=0; FAIL=0

check() {
  local desc="$1" condition="$2"
  if eval "$condition" &>/dev/null; then
    echo "  ✓ $desc"; PASS=$((PASS + 1))
  else
    echo "  ✗ $desc"; FAIL=$((FAIL + 1))
  fi
}

echo ""
echo "══════════════════════════════════════"
echo "  Advanced Suite Verification"
echo "══════════════════════════════════════"

echo ""
echo "── file with template vars ──────────"
check "config.ini written"                "test -f $HOME/.dotts-e2e/config.ini"
check "template: username rendered"       "grep -q 'username = dotts-test' $HOME/.dotts-e2e/config.ini"
check "template: region rendered"         "grep -q 'region   = us-east-1' $HOME/.dotts-e2e/config.ini"
check "template: no mustache leftovers"   "! grep -q '{{' $HOME/.dotts-e2e/config.ini"

echo ""
echo "── remoteFile ───────────────────────"
check "install.sh downloaded"             "test -f $HOME/.dotts-e2e/dotts-install.sh"
check "install.sh is executable"          "test -x $HOME/.dotts-e2e/dotts-install.sh"
check "install.sh has content"            "test -s $HOME/.dotts-e2e/dotts-install.sh"
check "install.sh looks like a script"   "head -1 $HOME/.dotts-e2e/dotts-install.sh | grep -q '#!/'"

echo ""
echo "── git ──────────────────────────────"
check "repo cloned"                       "test -d /tmp/dotts-e2e-clone"
check "repo is a git repo"               "test -d /tmp/dotts-e2e-clone/.git"
check "repo has README"                   "test -f /tmp/dotts-e2e-clone/README.md"

echo ""
echo "── unarchive: tar.gz ────────────────"
check "tgz extracted"                     "test -d /tmp/dotts-e2e-tgz"
check "tgz contains myproject dir"        "test -d /tmp/dotts-e2e-tgz/myproject"
check "tgz contains src/hello.txt"        "test -f /tmp/dotts-e2e-tgz/myproject/src/hello.txt"
check "tgz file has correct content"      "grep -q 'hello from archive' /tmp/dotts-e2e-tgz/myproject/src/hello.txt"

echo ""
echo "── unarchive: zip ───────────────────"
check "zip extracted"                     "test -d /tmp/dotts-e2e-zip"
check "zip contains myproject dir"        "test -d /tmp/dotts-e2e-zip/myproject"
check "zip contains README.md"            "test -f /tmp/dotts-e2e-zip/myproject/README.md"

echo ""
echo "── unarchive: stripComponents ───────"
check "stripped dir exists"               "test -d /tmp/dotts-e2e-stripped"
check "strip removed top-level dir"       "test -d /tmp/dotts-e2e-stripped/src"
check "strip: hello.txt at correct path"  "test -f /tmp/dotts-e2e-stripped/src/hello.txt"
check "strip: no myproject wrapper"       "! test -d /tmp/dotts-e2e-stripped/myproject"

echo ""
echo "── script: onlyIf ───────────────────"
check "onlyIf=true: script ran"          "test -f /tmp/dotts-e2e-onlyif.txt"
check "onlyIf=true: correct content"     "grep -q 'onlyif-ran' /tmp/dotts-e2e-onlyif.txt"
check "onlyIf=false: script did NOT run" "! test -f /tmp/dotts-e2e-onlyif-skip.txt"

echo ""
echo "── script: workingDir ───────────────"
check "workingDir script ran"            "test -f /tmp/dotts-e2e-pwd.txt"
check "workingDir was /tmp"              "grep -q '^/tmp' /tmp/dotts-e2e-pwd.txt"

echo ""
echo "── script: environment ──────────────"
check "env var script ran"              "test -f /tmp/dotts-e2e-env.txt"
check "env var value correct"           "grep -q 'hello-from-env' /tmp/dotts-e2e-env.txt"

echo ""
echo "── pkg: absent (removal) ────────────"
check "toilet was removed"              "! command -v toilet"

echo ""
echo "── pkg: version pin ─────────────────"
check "curl is installed"               "command -v curl"

echo ""
echo "── retries (happy path) ─────────────"
check "retries: script ran successfully" "test -f /tmp/dotts-e2e-retries.txt"

echo ""
echo "── platform guard ───────────────────"
check "linux platform guard ran"        "test -f /tmp/dotts-e2e-platform.txt"

echo ""
echo "══════════════════════════════════════"
echo "  Results: ${PASS} passed / ${FAIL} failed"
echo "══════════════════════════════════════"
echo ""
[ "$FAIL" -eq 0 ] || exit 1
