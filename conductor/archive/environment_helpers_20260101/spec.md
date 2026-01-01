# Spec: Environment-Specific Helpers

## Overview
Users often need to vary their configuration based on the operating system or Linux distribution. While standard TypeScript `if` statements work, they can become verbose. This track introduces fluent helpers like `onPlatform` and `onDistro` to make environment-based logic cleaner and more readable.

## User Stories
- **OS Branching:** As a user, I want to install `iterm2` only on macOS and `tilix` only on Linux without writing verbose `if` blocks.
- **Distro Specifics:** As a user, I want to run a specific setup script only when I am on Ubuntu.

## Technical Requirements
- **Helpers:**
    - `onPlatform(os, callback)`: Executes the callback only if the current OS matches.
    - `onDistro(distro, callback)`: Executes the callback only if the current Linux distribution matches.
- **Context Awareness:** Helpers should retrieve platform information from the active execution context (or a singleton service) to avoid requiring the user to pass the `app` object everywhere.
- **Async Support:** Support async callbacks for complex setup logic within helpers.

## Scope
- Implement `onPlatform` and `onDistro` in `src/public.ts`.
- Ensure `PlatformService` results are accessible to these helpers.
- Add unit tests verifying conditional execution across different simulated platforms.
