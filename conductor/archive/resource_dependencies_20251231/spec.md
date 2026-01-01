# Spec: Resource Dependencies & Ordering

## Overview
In Infrastructure as Code, resource ordering is critical. For example, a configuration file cannot be written to a directory that hasn't been created yet, or a service cannot be configured before its package is installed. This track introduces a declarative `dependsOn` mechanism and a topological sort in the execution engine.

## User Stories
- **Ordered Execution:** As a user, I want to specify that `FileResource('gitconfig')` depends on `PackageResource('git')` so that the package is always installed first.
- **Predictability:** As a user, I want the tool to automatically determine the correct execution order based on the dependency graph.
- **Safety:** As a user, I want to be warned if I accidentally create a circular dependency (A depends on B, B depends on A).

## Technical Requirements
- **Component Update:** Add `dependencies: Component[]` to the base `Component` class.
- **Topological Sort:** Implement a sorting algorithm (Kahn's or DFS-based) to order the flattened list of resources.
- **Graph Validation:** Before execution, verify that the dependency graph is a Directed Acyclic Graph (DAG).
- **Registry Integration:** The `Runner` needs to map dependency relationships across the flattened tree.

## Scope
- Update `Component` core class.
- Implement `GraphService` for sorting and cycle detection.
- Update `Runner` to use `GraphService` before execution.
