# Plan: User API & Developer Experience

## Phase 1: Fluent Helpers & Context
- [ ] Task: Implement `ActiveContext` to track the current stack and app
- [ ] Task: Implement functional helpers (`file`, `pkg`, `link`, `dir`, `script`, `secret`)
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Helpers' (Protocol in workflow.md)

## Phase 2: Functional Loader
- [ ] Task: Update `loader.ts` to support functional configurations via `export default`
- [ ] Task: Ensure the loader correctly sets the active context before execution
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Loader' (Protocol in workflow.md)

## Phase 3: Developer Experience & Templates
- [ ] Task: Create a single public entry point for all user-facing functions
- [ ] Task: Update `dotts init` template to use the new fluent style
- [ ] Task: Conductor - User Manual Verification 'Phase 3: DX' (Protocol in workflow.md)
