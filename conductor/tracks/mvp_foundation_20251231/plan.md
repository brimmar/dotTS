# Plan: MVP: Foundation and Core CLI

## Phase 1: Project Scaffolding [checkpoint: 6f5648a]
- [x] Task: Initialize Bun project and install core dependencies (Clack, Zod, Effect) [15b284f]
- [x] Task: Set up basic CLI entry point with Clack [2fe6099]
- [x] Task: Conductor - User Manual Verification 'Phase 1: Project Scaffolding' (Protocol in workflow.md)

## Phase 2: Configuration Schema [checkpoint: ea58541]
- [x] Task: Define the Zod schema for dotfile configuration (packages, files, symlinks) [681844b]
- [x] Task: Create TypeScript types derived from the Zod schema [b4af98e]
- [x] Task: Write tests for configuration validation [faf5592]
- [x] Task: Conductor - User Manual Verification 'Phase 2: Configuration Schema' (Protocol in workflow.md)

## Phase 3: Implement `init` Command
- [x] Task: Write Tests for `dotts init` command (creating folder structure and `dotts.ts` template) [81fb9fd]
- [x] Task: Implement `dotts init` command [ab43275]
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Implement init Command' (Protocol in workflow.md)

## Phase 4: Implement Basic `apply` Command
- [ ] Task: Write Tests for `dotts apply` (loading configuration and validating structure)
- [ ] Task: Implement configuration loading mechanism using Bun.build or direct import
- [ ] Task: Implement `dotts apply` (basic logging of actions to be taken)
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Implement Basic apply Command' (Protocol in workflow.md)
