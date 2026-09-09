# Gemini Project Context: dotts

`dotts` is a "Dotfiles as Code" CLI tool designed to manage system configurations using a declarative TypeScript-based API. It draws heavy inspiration from Infrastructure as Code (IaC) frameworks like AWS CDK, allowing users to define their system state (packages, symlinks, files, scripts) in code.

## Project Overview

- **Purpose:** Automate system setup and dotfile management.
- **Core Philosophy:** Declarative state definition using TypeScript, with built-in dependency management and parallelism.
- **Main Technologies:**
    - **Runtime:** [Bun](https://bun.sh/)
    - **Language:** TypeScript
    - **Logic & Side Effects:** [Effect](https://effect.website/) (Functional Programming library)
    - **Validation:** [Zod](https://zod.dev/)
    - **CLI Interface:** `@clack/prompts`
    - **Linting/Formatting:** [Biome](https://biomejs.dev/)
    - **Templating:** [Mustache](https://github.com/janl/mustache.js/)

## Building and Running

### Development Commands
- `bun install`: Install all project dependencies.
- `bun start`: Run the CLI in development mode (`bun src/index.ts`).
- `bun test`: Run the test suite.
- `bun run lint`: Run Biome linter.
- `bun run format`: Format code with Biome.
- `bun run type-check`: Run the TypeScript compiler to check types.
- `bun run build`: Compile the project into a standalone executable named `dotts`.
- `bun run ci`: Run all validation steps (test, lint, type-check, build).

### Usage
The CLI is interactive. Run `bun start` and follow the prompts to:
- `init`: Create a new `dotts` project.
- `prepare`: Refresh editor types after upgrading the CLI.
- `check`: Validate a `dotts.ts` configuration file.
- `apply`: Apply the configuration to the local system (includes a Dry Run mode).
- `doctor`: Run system diagnostics.
- `secrets`: Manage sensitive information used in templates.

## Architecture & Code Structure

### Directory Map
- `src/core/`: The engine of `dotts`. Includes the `App`, `Stack`, `Component`, and `Resource` base classes, as well as the `Runner` that executes the resource graph.
- `src/resources/`: Concrete implementations of system resources:
    - `package.ts`: Software package management (brew, apt, npm, etc.).
    - `file.ts` & `remote-file.ts`: File creation and management (supports Mustache templates).
    - `symlink.ts`: Symbolic link management.
    - `directory.ts`: Directory creation.
    - `script.ts`: Arbitrary command execution.
- `src/services/`: Service abstractions used by `Effect` layers (FileSystem, Exec, Secrets, Platform detection, etc.).
- `src/commands/`: CLI command implementations.
- `src/public.ts`: The public-facing API used in user configuration files.

### Design Patterns
- **CDK-like API:** Uses `App` and `Stack` to scope resources.
- **Functional Side Effects:** Uses `Effect` for all side effects (I/O, execution), ensuring testability and structured error handling.
- **Dependency Injection:** Services are provided to the logic via `Effect.provide(Layer)`.
- **Resource Graph:** Resources can depend on each other; the `Runner` calculates the execution order based on these dependencies.

## Development Conventions

- **Type Safety:** Strict TypeScript usage is expected. Use `Zod` for runtime validation of external inputs/configs.
- **Testing:** New features or resources should include a `.test.ts` file using `bun test`.
- **Linting:** Biome is strictly enforced. Ensure `bun run lint` passes before committing.
- **Error Handling:** Use the custom error types in `src/core/errors.ts` and ensure they are compatible with the `formatError` utility for CLI display.
- **Resource Implementation:** New resources should extend the `Resource` class and implement `apply()`, `destroy()`, and `hash()`.
- **Dry Run Support:** All resource `apply()` methods must respect the injected `FileSystem` and `SystemCommand` services, which are mocked during dry runs.
