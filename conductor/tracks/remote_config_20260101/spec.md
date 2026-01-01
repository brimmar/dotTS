# Spec: Remote Configuration Support

## Overview
Currently, `dotts apply` requires a local configuration file. This track adds support for applying configurations directly from remote repositories (e.g., GitHub) using a convenient shorthand like `user/repo`.

## User Stories
- **Easy Sharing:** As a user, I want to apply a shared configuration from a friend's GitHub repo with a single command.
- **Bootstrapping:** As a user, I want to set up my new machine by applying my own dotfiles repository immediately after installing `dotts`.

## Technical Requirements
- **Repository Resolution:** Support shorthand like `user/repo` (defaults to GitHub) and full URLs.
- **Remote Fetching:** Use `git clone` or ZIP downloads to retrieve the remote config.
- **Temporary Storage:** Store remote configurations in a temporary directory during execution.
- **Security Prompt:** Warn the user and ask for confirmation before executing remote code.

## Scope
- Implement a `RemoteRepoService` to handle repository resolution and fetching.
- Update the `apply` command to support remote identifiers.
- Add safety checks and user prompts for remote configurations.
- Add unit and integration tests.
