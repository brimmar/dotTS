# Spec: Secrets Management

## Overview
Secrets Management allows users to store and use sensitive data (like API tokens or private keys) in their `dotts` configurations without exposing them in plaintext or committing them to version control. Secrets will be stored encrypted on the local filesystem and resolved only at execution time.

## User Stories
- **Store Secret:** As a user, I want to securely store a secret value using the CLI.
- **Reference Secret:** As a user, I want to use a secret in my configuration (e.g., in a file's content) by its name.
- **Security:** As a user, I want my secrets to be encrypted so that they are not readable if my files are stolen or accidentally shared.

## Technical Requirements
- **Encryption:** Use AES-256-GCM (via Node `crypto`) for local encryption.
- **Storage:** Encrypted JSON file at `.dotts/secrets.json`.
- **Master Key:** A master key stored in the user's home directory (e.g., `~/.dotts_key`) or derived from a passphrase.
- **Resolution:** Secrets are resolved by the `Runner` just before `apply()` is called.

## Scope
- Implementation of a `SecretStore` service for encryption/decryption.
- CLI commands: `secrets set <name> <value>` and `secrets list`.
- Integration helper `config.secret(name)` for use in component definitions.
- Refactor `Runner` to inject resolved secrets into components.
