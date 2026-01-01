# Spec: Remote Fetching

## Overview
Dotfiles often depend on external assets like themes, binary plugins, or remote configuration templates. This track introduces a first-class `remoteFile` resource to safely download and manage these assets.

## User Stories
- **Asset Download:** As a user, I want to download a theme file or a binary plugin from a URL to a specific location on my system.
- **Integrity Verification:** As a user, I want to ensure that the downloaded file matches a specific SHA256 hash to prevent tampering or corruption.
- **Efficient Caching:** As a user, I don't want to re-download files that haven't changed or that I already have locally.

## Technical Requirements
- **Resource:** `RemoteFileResource`
    - `url`: The source URL.
    - `path`: Local destination path.
    - `sha256`: Optional hash for integrity verification.
    - `mode`, `owner`, `group`: POSIX attributes for the destination file.
- **Network Service:** A new service (perhaps using `fetch` via Bun) to handle downloads.
- **Idempotency:** The resource should only download if the destination file is missing, the hash mismatch, or the source URL content (if headers permit) indicates a change.
- **Progress Reporting:** Integration with the CLI spinner/progress bar for large downloads.

## Scope
- Implement `RemoteFileResource` in `src/resources/remote-file.ts`.
- Implement a basic `HttpService` for downloading files.
- Add support for SHA256 verification.
- Add unit tests with mocked network responses.
