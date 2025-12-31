# Plan: Resource Dependencies & Ordering

## Phase 1: Dependency Core
- [x] Task: Update `Component` and `Resource` to support `addDependency` and `dependsOn` property [12cad97]
- [~] Task: Conductor - User Manual Verification 'Phase 1: Dependency Core' (Protocol in workflow.md)

## Phase 2: Graph Sorting Engine
- [ ] Task: Implement a topological sort algorithm to order resources correctly
- [ ] Task: Implement cyclic dependency detection and user-friendly error reporting
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Graph Engine' (Protocol in workflow.md)

## Phase 3: Runner Integration
- [ ] Task: Update the `Runner` to sort the resource tree before execution
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Runner Integration' (Protocol in workflow.md)
