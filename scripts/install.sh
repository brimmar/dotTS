#!/bin/bash
set -euo pipefail

REPO="${DOTTS_REPO:-brimmar/dotTS}"
INSTALL_DIR="${DOTTS_DIR:-$HOME/.local/bin}"

die() {
  echo "$@" >&2
  exit 1
}

detect_os_arch() {
  local os arch

  os=$(uname -s | tr '[:upper:]' '[:lower:]')
  case "$os" in
    linux) os="linux" ;;
    darwin) os="darwin" ;;
    *) die "Unsupported OS: $os" ;;
  esac

  arch=$(uname -m)
  case "$arch" in
    x86_64|amd64) arch="x64" ;;
    aarch64|arm64) arch="arm64" ;;
    *) die "Unsupported architecture: $arch" ;;
  esac

  echo "${os}-${arch}"
}

download() {
  local url="$1"
  local dest="$2"

  if command -v curl &>/dev/null; then
    curl -fsSL "$url" -o "$dest"
  elif command -v wget &>/dev/null; then
    wget -qO "$dest" "$url"
  else
    die "neither curl nor wget found — install one of them first"
  fi
}

main() {
  local target
  target=$(detect_os_arch)

  local version="${1:-latest}"
  local binary="dotts-${target}"

  if [ "$version" = "latest" ]; then
    url="https://github.com/${REPO}/releases/latest/download/${binary}"
  else
    url="https://github.com/${REPO}/releases/download/${version}/${binary}"
  fi

  mkdir -p "$INSTALL_DIR"

  echo "downloading dotts (${target})..."
  download "$url" "${INSTALL_DIR}/dotts"
  chmod +x "${INSTALL_DIR}/dotts"

  echo "dotts installed to ${INSTALL_DIR}/dotts"

  if ! echo "$PATH" | tr ':' '\n' | grep -qx "$INSTALL_DIR"; then
    echo ""
    echo "  ${INSTALL_DIR} is not in your PATH."
    echo "  Add this to your shell profile (~/.bashrc, ~/.zshrc, etc):"
    echo "    export PATH=\"\$PATH:${INSTALL_DIR}\""
  fi
}

main "$@"
