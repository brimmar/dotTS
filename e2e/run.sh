#!/usr/bin/env bash
# dotts E2E test runner
# Usage: ./e2e/run.sh [--keep]
#   --keep   Don't remove the container after the test (for debugging)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="dotts-e2e:latest"
CONTAINER="dotts-e2e-run"
KEEP=false

for arg in "$@"; do
  [ "$arg" = "--keep" ] && KEEP=true
done

cleanup() {
  if [ "$KEEP" = false ]; then
    echo "→ Cleaning up..."
    docker rm -f "$CONTAINER" 2>/dev/null || true
  else
    echo "→ Container '${CONTAINER}' kept. Attach with:"
    echo "    docker exec -it ${CONTAINER} bash"
  fi
}
trap cleanup EXIT

echo ""
echo "══════════════════════════════════════"
echo "  dotts E2E Test Suite"
echo "══════════════════════════════════════"
echo ""

# 1. Build the binary fresh
echo "→ Building dotts binary..."
cd "$REPO_ROOT"
bun build ./src/index.ts --compile --outfile dotts
echo "  ✓ Binary built ($(du -sh dotts | cut -f1))"

# 2. Build the Docker image
echo ""
echo "→ Building Docker image..."
docker build \
  --file e2e/Dockerfile \
  --tag "$IMAGE" \
  --quiet \
  "$REPO_ROOT"
echo "  ✓ Image built: ${IMAGE}"

# 3. Run the container — apply the config, then verify
echo ""
echo "→ Launching container and applying config..."

DOCKER_OPTS="--name ${CONTAINER}"
[ "$KEEP" = false ] && DOCKER_OPTS="$DOCKER_OPTS --rm"

# shellcheck disable=SC2086
docker run \
  $DOCKER_OPTS \
  "$IMAGE" \
  bash -c "
    set -e
    echo '→ Running: dotts apply /home/testuser/dotts.ts'
    dotts apply /home/testuser/dotts.ts
    echo ''
    bash /home/testuser/verify.sh
  "

echo ""
echo "✓ All E2E tests passed!"
