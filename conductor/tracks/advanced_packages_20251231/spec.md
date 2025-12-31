# Spec: Advanced Package Management

## Overview
Package management is a core pillar of dotfile automation. This track transforms the basic `PackageResource` into a professional-grade, multi-provider system that adapts to the host platform and verifies the system state before taking action.

## User Stories
- **Cross-Platform:** As a user, I want my configuration to automatically use `brew` on macOS and `apt` or `pacman` on Linux without me changing the code.
- **Polyglot Dev:** As a user, I want to manage packages for different ecosystems like Rust (`cargo`), Python (`pip`), and Ruby (`gem`).
- **Performance:** As a user, I want `dotts` to skip package installation if the tool is already in my `$PATH`, even if the `state.json` is empty.
- **Reliability:** As a user, I want to ensure specific versions of tools are installed to maintain a consistent environment.

## Technical Requirements
- **PlatformService:**
    - Detect OS (`darwin`, `linux`).
    - Detect Linux distribution (via `/etc/os-release`).
    - Detect Architecture (`x64`, `arm64`).
- **Provider Pattern:**
    - Abstract `PackageProvider` interface with `install`, `uninstall`, and `isInstalled` methods.
    - Specialized providers for each manager.
- **Dynamic Selection:** `PackageResource` uses `PlatformService` to pick the best provider if none is explicitly specified.
- **System-State Idempotency:** The `isInstalled` check uses system commands (e.g., `which`, `pkg-manager list`) to verify the actual state.

## Scope
- Implementation of `PlatformService`.
- Refactor `PackageResource` to use the Provider pattern.
- Implement providers for `brew`, `apt`, `pacman`, `bun`, `npm`, `cargo`, `pip`.
- Add `version` support to `PackageResourceProps` and implementation.
