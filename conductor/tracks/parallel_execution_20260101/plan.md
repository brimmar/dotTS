# Plan: Parallel Execution

## Phase 1: Batched Execution Engine [checkpoint: b56de3b]
- [x] Task: Implement "tier-based" sorting in `Graph` engine to group parallelizable resources [e799795]
- [x] Task: Refactor `Runner.run()` to execute resource tiers concurrently using `Effect.all` [12b329b]
- [x] Task: Conductor - User Manual Verification 'Phase 1: Batched Execution' (Protocol in workflow.md)

## Phase 2: Resource Constraints & Locking [checkpoint: f3ee136]
- [x] Task: Implement a tagging/locking mechanism for resources that cannot run in parallel (e.g., package managers) [210434d]
- [x] Task: Ensure the `Runner` respects these constraints during concurrent execution [210434d]
- [x] Task: Conductor - User Manual Verification 'Phase 2: Constraints' (Protocol in workflow.md)

## Phase 3: Performance & UX Polish
- [ ] Task: Add execution timing metrics to the CLI summary
- [ ] Task: Optimize Clack output for concurrent operations (prevent text overlapping/jank)
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Polish' (Protocol in workflow.md)
