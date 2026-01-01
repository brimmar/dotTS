# Spec: Advanced File Management

## Overview
Files are the backbone of dotfiles. Simple string-based content is often insufficient. This track enhances `FileResource` to handle POSIX attributes (mode, owner, group) and dynamic content generation via a templating engine. It also introduces a dedicated `DirectoryResource`.

## User Stories
- **Secure Configs:** As a user, I want to set `0600` permissions on my private keys and sensitive config files.
- **Dynamic Content:** As a user, I want to use templates to inject environment-specific variables or secrets into my configuration files.
- **Explicit Directories:** As a user, I want to explicitly manage directory existence and permissions.

## Technical Requirements
- **FileSystem Service Update:** Add `chmod` and `chown` methods.
- **Templating:** Use `mustache` for logic-less templating.
- **Resource Attributes:** Update `FileResourceProps` to include `mode`, `owner`, and `group`.
- **DirectoryResource:** Implement a new primitive resource for directory management.

## Scope
- Update `FileSystem` service.
- Enhance `FileResource` with POSIX attributes.
- Integrate `mustache` and add template support to `FileResource`.
- Implement `DirectoryResource`.
