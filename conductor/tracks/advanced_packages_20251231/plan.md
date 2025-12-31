# Plan: Advanced Package Management

## Phase 1: Platform Awareness
- [x] Task: Implement `PlatformService` for OS and Linux distribution detection [1d91577]
- [x] Task: Update `PackageResource` to use `PlatformService` for smart default manager selection [5cbd86d]
- [~] Task: Conductor - User Manual Verification 'Phase 1: Platform Awareness' (Protocol in workflow.md)

## Phase 2: Provider Abstraction [checkpoint: fb316b6]
- [x] Task: Implement `PackageProvider` interface and refactor existing managers into providers [f59438d]
- [x] Task: Implement new providers for `Cargo` and `Pip` [f59438d]
- [x] Task: Conductor - User Manual Verification 'Phase 2: Provider Abstraction' (Protocol in workflow.md)

## Phase 3: System-State Idempotency
- [ ] Task: Implement `isInstalled` check for all providers using system commands
- [ ] Task: Update `PackageResource` to skip `apply` if package is already found on system
- [ ] Task: Conductor - User Manual Verification 'Phase 3: System Idempotency' (Protocol in workflow.md)

## Phase 4: Versioning Support
- [ ] Task: Add versioning support to `PackageResourceProps` and provider commands
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Versioning' (Protocol in workflow.md)
