# Plan: State Management & Idempotency

## Phase 1: State Service & Hashing [checkpoint: b2b6f5d]
- [x] Task: Implement `StateService` for loading and saving `.dotts/state.json` [7259ce4]
- [x] Task: Implement a hashing utility to generate unique signatures for resource configurations [9ba4f59]
- [x] Task: Conductor - User Manual Verification 'Phase 1: State Service' (Protocol in workflow.md)

## Phase 2: Resource Lifecycle (Destroy) [checkpoint: e8e1024]
- [x] Task: Add `destroy()` method to `Resource` base class [e8e1024]
- [x] Task: Implement `destroy()` for `FileResource`, `SymlinkResource`, and `PackageResource` [e8e1024]
- [x] Task: Conductor - User Manual Verification 'Phase 2: Resource Lifecycle' (Protocol in workflow.md)

## Phase 3: Runner Orchestration
- [x] Task: Update `Runner` to compute the diff between desired config and existing state [84b5f2d]
- [x] Task: Implement the execution logic for Create, Update, and Delete actions in the `Runner` [84b5f2d]
- [~] Task: Update the CLI `apply` output to display resource action status (e.g., + Create, ~ Update, - Delete)
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Runner Orchestration' (Protocol in workflow.md)
