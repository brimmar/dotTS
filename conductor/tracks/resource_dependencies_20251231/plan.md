# Plan: Resource Dependencies & Ordering

## Phase 1: Dependency Core [checkpoint: 217772c]
- [x] Task: Update `Component` and `Resource` to support `addDependency` and `dependsOn` property [12cad97]
- [x] Task: Conductor - User Manual Verification 'Phase 1: Dependency Core' (Protocol in workflow.md)

## Phase 2: Graph Sorting Engine [checkpoint: 2efd10d]
- [x] Task: Implement a topological sort algorithm to order resources correctly [2ff8bad]
- [x] Task: Implement cyclic dependency detection and user-friendly error reporting [2ff8bad]
- [x] Task: Conductor - User Manual Verification 'Phase 2: Graph Engine' (Protocol in workflow.md)

## Phase 3: Runner Integration [checkpoint: 3b419a8]
- [x] Task: Update the `Runner` to sort the resource tree before execution [c51b089]
- [x] Task: Conductor - User Manual Verification 'Phase 3: Runner Integration' (Protocol in workflow.md)
