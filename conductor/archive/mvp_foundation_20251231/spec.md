# Spec: MVP: Foundation and Core CLI

## Overview
This track focuses on establishing the fundamental architecture of the `dotts` CLI tool. The goal is to create a functional MVP that allows users to initialize a configuration project and execute a basic "apply" command that demonstrates the type-safe configuration model.

## User Stories
- **Initialize Project:** As a developer, I want to run `dotts init` to scaffold a project with a `dotts.ts` configuration file.
- **Apply Configuration:** As a user, I want to run `dotts apply` to see the tool process my type-safe configuration and provide feedback.
- **Type-Safety:** As a developer, I want to get IDE autocompletion and validation when editing my `dotts.ts` file.

## Technical Requirements
- **Runtime:** Bun
- **Language:** TypeScript
- **CLI UI:** Clack
- **Validation:** Zod
- **Logic & Effects:** Effect
- **Configuration Format:** TypeScript file (`dotts.ts`) that exports a configuration object.

## Scope
- Scaffolding of a Bun-based CLI project.
- Definition of the core Zod schema for dotfile configuration.
- Implementation of the `init` command.
- Implementation of a "dry-run" or basic `apply` command that validates and logs the intended system changes.
