# Plan: User API & Developer Experience

## Phase 1: Fluent Helpers & Context [checkpoint: dcf8392]
- [x] Task: Implement `ActiveContext` to track the current stack and app [51fb818]
- [x] Task: Implement functional helpers (`file`, `pkg`, `link`, `dir`, `script`, `secret`) [0011733]
- [x] Task: Conductor - User Manual Verification 'Phase 1: Helpers' (Protocol in workflow.md)

## Phase 2: Functional Loader [checkpoint: 72c3da0]
- [x] Task: Update `loader.ts` to support functional configurations via `export default` [5bc6267]
- [x] Task: Ensure the loader correctly sets the active context before execution [5bc6267]
- [x] Task: Conductor - User Manual Verification 'Phase 2: Loader' (Protocol in workflow.md)

## Phase 3: Developer Experience & Templates [checkpoint: 527a01b]
- [x] Task: Create a single public entry point for all user-facing functions [a90f86a]
- [x] Task: Update `dotts init` template to use the new fluent style [a90f86a]
- [x] Task: Conductor - User Manual Verification 'Phase 3: DX' (Protocol in workflow.md)
