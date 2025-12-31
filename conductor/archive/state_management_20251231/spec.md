# Spec: State Management & Idempotency

## Overview
State management enables `dotts` to move beyond a simple "one-way" execution engine to a full lifecycle management tool. By tracking what has been deployed, `dotts` can safely remove old resources that are no longer in the configuration and skip work for resources that haven't changed.

## User Stories
- **Garbage Collection:** As a user, when I remove a file or package from my `dotts.ts` and run `apply`, I want that resource to be removed from my system.
- **Idempotency:** As a user, I want `dotts` to be fast and only perform actions for things that have actually changed.
- **Visibility:** As a user, I want to see which resources are being created, updated, or deleted during a `dry-run`.

## Technical Requirements
- **State File:** A JSON file at `.dotts/state.json` containing a map of resource IDs to their last-applied configuration hash and metadata.
- **Hashing:** Use SHA-256 to hash resource configurations (e.g., file content + path).
- **Lifecycle Methods:**
    - `apply()`: Ensures the resource exists as configured.
    - `destroy()`: Reverts the resource (delete file, remove package).
- **Diffing Logic:** The Runner identifies:
    - **Create:** Resource in config, not in state.
    - **Update:** Resource in config and state, but hash differs.
    - **Delete:** Resource in state, but not in config.
    - **No-op:** Resource in config and state, hash matches.

## Scope
- Implement `StateService` for state file persistence.
- Add `destroy()` method to `Resource` and its implementations.
- Refactor `Runner` to implement the diffing and lifecycle orchestration.
- Update CLI output to show Create/Update/Delete status.
