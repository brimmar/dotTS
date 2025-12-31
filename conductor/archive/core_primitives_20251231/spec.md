# Spec: Core Primitives: Component System & Execution Engine

## Overview
This track aims to elevate `dotts` from a static configuration tool to a programmable "Infrastructure as Code" (IaC) solution for dotfiles. By mirroring the component-based approach of tools like SST, we will introduce a `Component` architecture that allows for reusable, type-safe definitions of system state. Alongside this, a robust Execution Engine will be built to safely applying these configurations to the host system.

## User Stories
- **Programmable Config:** As a user, I want to define my dotfiles using reusable components (e.g., `new Zsh()`) rather than flat lists.
- **Safe Execution:** As a user, I want `dotts apply` to make actual changes to my system safely, backing up existing files if necessary.
- **Idempotency:** As a user, I want to run `dotts apply` multiple times without side effects or errors.
- **Dry Run:** As a user, I want to verify what changes will happen before they are executed.

## Technical Requirements
- **Language:** TypeScript
- **Runtime:** Bun
- **Libraries:** Effect (for safe side-effect management), Zod (validation)
- **Architecture:**
    - **Component:** Abstract base class for all resources.
    - **Resource:** Concrete implementations (File, Symlink, Package).
    - **Context:** State management for the current execution run.
    - **Runner:** The engine that traverses the component tree and executes actions.

## Scope
- Design and implement the `Component` base class and interface.
- Implement the "Runner" using `Effect` to handle file system operations (write, symlink, backup) and command execution.
- Create core primitive components: `FileComponent`, `SymlinkComponent`, `PackageComponent`.
- Refactor the existing `dotts apply` command to use the new Runner.
- Implement a `--dry-run` flag for the apply command.
