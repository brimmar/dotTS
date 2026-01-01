# Plan: Environment-Specific Helpers

## Phase 1: Platform & Distro Helpers [checkpoint: 0d8b103]
- [x] Task: Implement `onPlatform` and `onDistro` functional helpers [cf410a0]
- [x] Task: Integrate helpers with `PlatformService` via context [cf410a0]
- [x] Task: Conductor - User Manual Verification 'Phase 1: Helpers' (Protocol in workflow.md)

## Phase 2: Refinement & Validation
- [~] Task: Support multiple OS/Distro matches (e.g., `onPlatform(['darwin', 'linux'], ... )`)
- [~] Task: Ensure helpers are correctly typed for IDE autocompletion
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Refinement' (Protocol in workflow.md)

## Phase 3: Documentation & Examples
- [ ] Task: Update the `dotts init` template or provide a snippet in documentation
- [ ] Task: Conductor - User Manual Verification 'Phase 3: DX' (Protocol in workflow.md)
