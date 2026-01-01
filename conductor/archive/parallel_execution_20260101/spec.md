# Spec: Parallel Execution

## Overview
Currently, the `Runner` executes resources sequentially based on a topological sort of the dependency graph. While correct, this doesn't leverage the full potential of multi-core systems or asynchronous I/O. This track introduces parallel execution for independent resources and branches of the dependency graph.

## User Stories
- **Faster Setup:** As a user, I want my system setup to be as fast as possible by running independent tasks (like installing multiple packages or writing multiple files) at the same time.
- **Efficient I/O:** As a user, I want the tool to utilize my network and disk I/O efficiently by not waiting for one download to finish before starting the next one.

## Technical Requirements
- **Concurrent Execution:** Use `Effect.all` with concurrency limits to run independent resources.
- **Graph Batching:** Group resources into "tiers" or "batches" where each batch contains resources that have no dependencies on each other and all their own dependencies are already satisfied.
- **Resource Locking:** Ensure that resources competing for the same lock (e.g., package managers like `apt` or `brew`) are handled correctly (either by serializing them or letting the OS handle the lock).
- **Progress Tracking:** Update the CLI UI to handle multiple concurrent progress updates gracefully.

## Scope
- Refactor `Runner` to support concurrent execution.
- Implement dependency-aware batching logic.
- Add concurrency control for "singleton" resources (like package managers).
- Verify performance improvements with benchmarks.
