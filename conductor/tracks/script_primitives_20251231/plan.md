# Plan: Script Primitives

## Phase 1: Basic Script Resource
- [x] Task: Update `SystemCommand` service to support `workingDir` and `environment` variables [d4e794c]
- [~] Task: Implement `ScriptResource` with basic `run` and `workingDir` support
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Basic Script' (Protocol in workflow.md)

## Phase 2: Conditional Execution
- [ ] Task: Implement `unless` logic for script idempotency
- [ ] Task: Implement `onlyIf` logic for script guards
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Conditionals' (Protocol in workflow.md)

## Phase 3: CLI & Schema Integration
- [ ] Task: Update `DottsSchema` and `loader.ts` to support `scripts`
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Integration' (Protocol in workflow.md)
