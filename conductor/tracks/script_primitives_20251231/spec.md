# Spec: Script Primitives

## Overview
While declarative resources (Files, Packages) cover most needs, some system configurations require arbitrary shell commands. This track introduces a `ScriptResource` that allows users to run custom scripts safely and idempotently.

## User Stories
- **Custom Setup:** As a user, I want to run a complex setup command (e.g., `sh -c "$(curl ...)"`) that isn't covered by a built-in resource.
- **Idempotency:** As a user, I only want my script to run if it's actually needed (e.g., if a certain file doesn't exist or a command returns a specific code).
- **Environment Control:** As a user, I want to specify the working directory and environment variables for my script.

## Technical Requirements
- **ScriptResource:** A new primitive resource.
- **Properties:**
    - `run`: The command string to execute.
    - `unless`: Optional command. If it succeeds (exit 0), `run` is skipped.
    - `onlyIf`: Optional command. `run` only executes if this succeeds (exit 0).
    - `workingDir`: Directory to execute in.
    - `environment`: Key-value pairs for environment variables.
- **Execution Engine Integration:** Update `Runner` or ensure `SystemCommand` handles these new requirements.

## Scope
- Implement `ScriptResource` class.
- Update `SystemCommand` service if needed (e.g., for `workingDir` or `environment`).
- Add Zod schema for `ScriptResource`.
- Integration into `loader.ts` and CLI commands.
