# Spec: User API & Developer Experience

## Overview
Currently, `dotts` configurations are defined by exporting a static object that matches a Zod schema. While functional, this lacks the flexibility and "feel" of modern Infrastructure as Code tools. This track introduces a programmatic User API that allows users to use logic, loops, and clean helper functions to define their system state.

## User Stories
- **Fluent API:** As a user, I want to use simple functions like `pkg('git')` instead of manually creating objects or knowing about Stacks and Apps.
- **Programmatic Control:** As a user, I want to use standard TypeScript logic (if/else, switch, map) within my configuration to adapt to different environments.
- **Reduced Boilerplate:** As a user, I don't want to export a complex object; I want to just write a function that "does the work".

## Technical Requirements
- **Context Management:** A global or scoped "Active Stack" tracker. When a helper function like `file()` is called, it automatically registers itself with the currently active stack.
- **Fluent Helpers:**
    - `file(path, props)`: Creates a `FileResource`.
    - `pkg(name, props)`: Creates a `PackageResource`.
    - `link(path, source)`: Creates a `SymlinkResource`.
    - `dir(path, props)`: Creates a `DirectoryResource`.
    - `script(props)`: Creates a `ScriptResource`.
    - `secret(name)`: Returns a `SecretToken`.
- **Loader Evolution:** `loadConfig` must detect if `export default` is a function. If so, it creates an `App` and `Stack`, sets the "Active Stack", and executes the function.
- **Public Entry Point:** All helpers should be exported from a clean public API surface.

## Scope
- Implement `Context` and `Registry` for the Active Stack.
- Implement all functional helpers.
- Refactor `loader.ts` to support both object-based (legacy) and function-based configurations.
- Update `init` command to generate the new style by default.
