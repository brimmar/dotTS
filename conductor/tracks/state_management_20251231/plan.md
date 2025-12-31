# Plan: State Management & Idempotency

## Phase 1: State Service & Hashing
- [ ] Task: Implement `StateService` for loading and saving `.dotts/state.json`
- [ ] Task: Implement a hashing utility to generate unique signatures for resource configurations
- [ ] Task: Conductor - User Manual Verification 'Phase 1: State Service' (Protocol in workflow.md)

## Phase 2: Resource Lifecycle (Destroy)
- [ ] Task: Add `destroy()` method to `Resource` base class
- [ ] Task: Implement `destroy()` for `FileResource`, `SymlinkResource`, and `PackageResource`
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Resource Lifecycle' (Protocol in workflow.md)

## Phase 3: Runner Orchestration
- [ ] Task: Update `Runner` to compute the diff between desired config and existing state
- [ ] Task: Implement the execution logic for Create, Update, and Delete actions in the `Runner`
- [ ] Task: Update the CLI `apply` output to display resource action status (e.g., + Create, ~ Update, - Delete)
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Runner Orchestration' (Protocol in workflow.md)
