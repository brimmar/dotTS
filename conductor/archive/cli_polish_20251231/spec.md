# Spec: CLI Polish & Validation

## Overview
As `dotts` grows in complexity, the CLI needs to provide better feedback to the user. This track focuses on proactively identifying configuration errors and system incompatibilities before they cause deployment failures.

## User Stories
- **Validate Config:** As a user, I want to verify that my `dotts.ts` is valid (schema, paths, secrets) without actually applying any changes.
- **System Check:** As a user, I want a way to check if my environment has all the necessary tools (Bun, Brew, etc.) installed and configured correctly.
- **Friendly Errors:** As a user, if something goes wrong, I want a clear explanation of what happened and how I might fix it, rather than a raw stack trace.

## Technical Requirements
- **Validator Service:** A service that traverses the component tree and performs:
    - Zod schema validation.
    - Path existence/permission checks (for sources).
    - Secret resolution checks (verify secret exists in `secrets.json`).
- **Doctor Checks:** A suite of checks for:
    - OS type and version.
    - Presence of `brew`, `apt`, `npm`, etc.
    - File system permissions in key directories.
- **Error Formatter:** A utility to map internal `Effect` errors or `Error` objects to Clack-friendly diagnostic messages.

## Scope
- Implementation of `ValidationService`.
- New CLI commands: `check` and `doctor`.
- Refactor global error handling in `src/index.ts` and `src/commands/apply.ts`.
