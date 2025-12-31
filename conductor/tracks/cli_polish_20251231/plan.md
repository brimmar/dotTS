# Plan: CLI Polish & Validation

## Phase 1: Validation Engine [checkpoint: e19beb6]
- [x] Task: Implement a `ValidationService` to check schema, path validity, and secret references [3d3c547]
- [x] Task: Conductor - User Manual Verification 'Phase 1: Validation Engine' (Protocol in workflow.md)

## Phase 2: Check Command [checkpoint: 5a73e9c]
- [x] Task: Implement `dotts check` command to run the Validator on a config file [f6421ec]
- [x] Task: Conductor - User Manual Verification 'Phase 2: Check Command' (Protocol in workflow.md)

## Phase 3: Doctor Command
- [x] Task: Implement `dotts doctor` command with system environment checks [23e1705]
- [~] Task: Conductor - User Manual Verification 'Phase 3: Doctor Command' (Protocol in workflow.md)

## Phase 4: Enhanced Error Reporting
- [ ] Task: Implement user-friendly error formatting for Runner and CLI exceptions
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Error Handling' (Protocol in workflow.md)
