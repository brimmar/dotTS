# Plan: Script Primitives

## Phase 1: Basic Script Resource [checkpoint: 2ba7d47]
- [x] Task: Update `SystemCommand` service to support `workingDir` and `environment` variables [d4e794c]
- [x] Task: Implement `ScriptResource` with basic `run` and `workingDir` support [4fb4f11]
- [x] Task: Conductor - User Manual Verification 'Phase 1: Basic Script' (Protocol in workflow.md)

## Phase 2: Conditional Execution [checkpoint: dab0c0d]
- [x] Task: Implement `unless` logic for script idempotency [ab0fd2b]
- [x] Task: Implement `onlyIf` logic for script guards [ab0fd2b]
- [x] Task: Conductor - User Manual Verification 'Phase 2: Conditionals' (Protocol in workflow.md)

## Phase 3: CLI & Schema Integration [checkpoint: b647939]
- [x] Task: Update `DottsSchema` and `loader.ts` to support `scripts` [1be336b]
- [x] Task: Conductor - User Manual Verification 'Phase 3: Integration' (Protocol in workflow.md)
