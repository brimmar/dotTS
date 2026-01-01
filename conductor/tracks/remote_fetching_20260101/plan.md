# Plan: Remote Fetching

## Phase 1: Basic Remote Download [checkpoint: 7ab123d]
- [x] Task: Implement `HttpService` using Bun's native `fetch` [8bd0648]
- [x] Task: Create `RemoteFileResource` and functional helper `remoteFile()` [69e6e37]
- [x] Task: Conductor - User Manual Verification 'Phase 1: Basic Download' (Protocol in workflow.md)

## Phase 2: Integrity & Attributes [checkpoint: 298b21d]
- [x] Task: Implement SHA256 verification for `RemoteFileResource` [5a66c76]
- [x] Task: Support setting POSIX attributes (mode, owner, group) on downloaded files [5a66c76]
- [x] Task: Conductor - User Manual Verification 'Phase 2: Integrity' (Protocol in workflow.md)
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Integrity' (Protocol in workflow.md)

## Phase 3: UX & Progress
- [ ] Task: Add progress reporting for downloads to the CLI
- [ ] Task: Implement basic caching (Etag support)
- [ ] Task: Conductor - User Manual Verification 'Phase 3: DX' (Protocol in workflow.md)
