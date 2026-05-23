#!/usr/bin/env bash
# dotts E2E test runner — all suites
# Usage: ./e2e/run.sh [--suite <name>] [--keep] [--no-build]
#   --suite basic|advanced|system|secrets|service  Run only one suite
#   --keep     Keep containers alive after run (for debugging)
#   --no-build Skip binary rebuild (use existing ./dotts)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KEEP=false
NO_BUILD=false
SUITE=""

for arg in "$@"; do
  case "$arg" in
    --keep)     KEEP=true ;;
    --no-build) NO_BUILD=true ;;
    --suite)    shift; SUITE="$1" ;;
    --suite=*)  SUITE="${arg#--suite=}" ;;
  esac
done

SUITES=("basic" "advanced" "system" "secrets")
if [ -n "$SUITE" ]; then
  SUITES=("$SUITE")
fi

TOTAL_PASS=0
TOTAL_FAIL=0

hr() { echo "──────────────────────────────────────"; }

run_suite() {
  local suite="$1"
  local image="dotts-e2e-${suite}:latest"
  local container="dotts-e2e-${suite}-run"

  echo ""
  echo "╔══════════════════════════════════════╗"
  echo "║  Suite: ${suite^^}"
  echo "╚══════════════════════════════════════╝"

  local docker_opts="--name ${container}"
  [ "$KEEP" = false ] && docker_opts="$docker_opts --rm"

  local dockerfile="${REPO_ROOT}/e2e/Dockerfile"
  local run_cmd=""

  case "$suite" in
    service)
      dockerfile="${REPO_ROOT}/e2e/suites/service/Dockerfile.systemd"
      ;;
  esac

  # Build suite image
  echo "→ Building image ${image}..."
  docker build \
    --file "$dockerfile" \
    --tag "$image" \
    --quiet \
    "$REPO_ROOT" 2>&1 | tail -1
  echo "  ✓ Image built"

  # Build run command per suite
  case "$suite" in
    basic)
      run_cmd="
        set -e
        dotts apply /home/testuser/basic.ts
        bash /home/testuser/verify-basic.sh
      "
      ;;

    advanced)
      run_cmd="
        set -e
        dotts apply /home/testuser/advanced.ts
        bash /home/testuser/verify-advanced.sh
      "
      ;;

    system)
      run_cmd="
        set -e
        dotts apply /home/testuser/system.ts
        bash /home/testuser/verify-system.sh
      "
      ;;

    secrets)
      run_cmd="
        set -e
        # Set up secrets before applying
        mkdir -p .dotts
        dotts secrets set DB_PASSWORD 'supersecret123'
        dotts secrets set API_KEY 'test-api-key-abc'

        # Test check command
        dotts check /home/testuser/secrets.ts

        # Test init command
        dotts init /tmp/dotts-init-test

        # Test dry-run (write a sentinel that SHOULD NOT be created)
        dotts apply /home/testuser/basic.ts --dry-run

        bash /home/testuser/verify-secrets.sh
      "
      ;;

    service)
      run_cmd="
        set -e
        # Wait for systemd to finish booting
        sleep 3
        su - testuser -c 'dotts apply /home/testuser/service.ts && bash /home/testuser/verify.sh'
      "
      ;;
  esac

  echo "→ Running suite..."

  local exit_code=0
  if [ "$suite" = "service" ]; then
    # Systemd containers need --privileged and different entry
    # shellcheck disable=SC2086
    docker run \
      $docker_opts \
      --privileged \
      --tmpfs /run \
      --tmpfs /run/lock \
      -v /sys/fs/cgroup:/sys/fs/cgroup:rw \
      --cgroupns host \
      -d \
      "$image" || { echo "  ✗ Failed to start container"; return 1; }

    sleep 4  # Wait for systemd

    docker exec "${container}" bash -c "$run_cmd" || exit_code=$?

    if [ "$KEEP" = false ]; then
      docker stop "${container}" 2>/dev/null || true
      docker rm "${container}" 2>/dev/null || true
    fi
  else
    # shellcheck disable=SC2086
    docker run \
      $docker_opts \
      "$image" \
      bash -c "$run_cmd" || exit_code=$?
  fi

  if [ "$exit_code" -eq 0 ]; then
    echo ""
    echo "✓ Suite '${suite}' PASSED"
    TOTAL_PASS=$((TOTAL_PASS + 1))
  else
    echo ""
    echo "✗ Suite '${suite}' FAILED (exit code ${exit_code})"
    TOTAL_FAIL=$((TOTAL_FAIL + 1))
    if [ "$KEEP" = true ]; then
      echo "  Container '${container}' is still running — attach with:"
      echo "    docker exec -it ${container} bash"
    fi
  fi
}

# ── Main ─────────────────────────────────────────────────────────────────────

echo ""
echo "╔══════════════════════════════════════╗"
echo "║       dotts E2E Test Runner          ║"
echo "╚══════════════════════════════════════╝"
echo "  Suites: ${SUITES[*]}"
echo ""

# Build binary (once, shared across suites)
if [ "$NO_BUILD" = false ]; then
  echo "→ Building dotts binary..."
  cd "$REPO_ROOT"
  bun build ./src/index.ts --compile --outfile dotts
  echo "  ✓ Binary built ($(du -sh dotts | cut -f1))"
fi

# Run each suite
for suite in "${SUITES[@]}"; do
  run_suite "$suite"
done

# Summary
echo ""
echo "╔══════════════════════════════════════╗"
echo "║  Final Summary"
echo "╠══════════════════════════════════════╣"
echo "║  Suites passed : ${TOTAL_PASS}"
echo "║  Suites failed : ${TOTAL_FAIL}"
echo "╚══════════════════════════════════════╝"
echo ""

[ "$TOTAL_FAIL" -eq 0 ] || exit 1
echo "✓ All E2E suites passed!"
