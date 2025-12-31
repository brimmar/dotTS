# Tech Stack - dotts

## Core Runtime
- **Bun:** Chosen for its high performance, built-in TypeScript support, and ability to compile to a single binary.

## Languages
- **TypeScript:** The primary language for both the CLI implementation and the user-facing configuration scripts, ensuring end-to-end type safety.

## CLI Framework & UI
- **Clack:** Used to build a clean, minimalist, and interactive CLI experience that aligns with our product guidelines.

## Configuration & Validation
- **Zod:** Employed for defining and validating the structure of dotfile configurations, providing excellent TypeScript integration.

## Architecture & Logic
- **Effect:** A powerful library for building robust, type-safe, and testable applications. It will manage our side effects, error handling, and dependency management.

## Distribution
- **Bun Compile:** We will distribute the CLI as a self-contained binary, making it easy to install without requiring a pre-existing Node.js or Bun environment.
