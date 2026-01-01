# Plan: Remote Configuration Support

## Phase 1: Repository Resolver & Fetcher [checkpoint: 5a9cd41]
- [x] Task: Implement `RemoteRepoService` for shorthand resolution and cloning [cb1e4c8]
- [x] Task: Add utility to handle temporary directory management [5d2bdd7]
- [x] Task: Conductor - User Manual Verification 'Phase 1: Resolver' (Protocol in workflow.md)

## Phase 2: Remote Apply Integration
- [ ] Task: Update `dotts apply` to detect and handle remote repository strings
- [ ] Task: Implement the "Trust Prompt" for remote configurations
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Remote Apply' (Protocol in workflow.md)

## Phase 3: UX Polish
- [ ] Task: Add caching for remote repositories to speed up repeated applies
- [ ] Task: Support branch/tag selection (e.g., `user/repo#branch`)
- [ ] Task: Conductor - User Manual Verification 'Phase 3: DX' (Protocol in workflow.md)
