# Plan: Core Primitives: Component System & Execution Engine

## Phase 1: Component Architecture Design [checkpoint: c0a63cc]
- [x] Task: Define the `Component` and `Resource` interfaces and base classes [d36984e]
- [x] Task: Implement a `Stack` or `App` container to hold the component tree [a338320]
- [x] Task: Conductor - User Manual Verification 'Phase 1: Component Architecture' (Protocol in workflow.md)

## Phase 2: Execution Engine (The Runner) [checkpoint: d662658]
- [x] Task: Create `Effect` services for FileSystem operations (write, exists, backup) [c60e3bd]
- [x] Task: Create `Effect` services for System Command execution [77317a3]
- [x] Task: Implement the core `Runner` logic to traverse the component tree and generate an Execution Plan [30a1ec1]
- [x] Task: Conductor - User Manual Verification 'Phase 2: Execution Engine' (Protocol in workflow.md)

## Phase 3: Core Primitive Components [checkpoint: bb5c923]
- [x] Task: Implement `FileComponent` with content and permissions handling [0d9e8a9]
- [x] Task: Implement `SymlinkComponent` with target validation [4751a02]
- [x] Task: Implement `PackageComponent` with simple manager delegation [2222f24]
- [x] Task: Conductor - User Manual Verification 'Phase 3: Core Primitive Components' (Protocol in workflow.md)

## Phase 4: CLI Integration & Dry Run [checkpoint: 5ca7489]
- [x] Task: Refactor `dotts apply` to accept a `--dry-run` flag [b10f179]
- [x] Task: Wire the Runner into the CLI to execute the plan (or log it for dry-run) [b10f179]
- [x] Task: Conductor - User Manual Verification 'Phase 4: CLI Integration' (Protocol in workflow.md)
