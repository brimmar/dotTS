# Plan: Secrets Management

## Phase 1: Secret Storage & Encryption
- [ ] Task: Implement a `SecretStore` service using Node's `crypto` module for encryption/decryption
- [ ] Task: Implement storage logic to save/load encrypted secrets from `.dotts/secrets.json`
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Secret Storage' (Protocol in workflow.md)

## Phase 2: CLI Secret Management
- [ ] Task: Add `secrets set` command to the CLI
- [ ] Task: Add `secrets list` command to the CLI (masked output)
- [ ] Task: Conductor - User Manual Verification 'Phase 2: CLI Secret Management' (Protocol in workflow.md)

## Phase 3: Component Integration
- [ ] Task: Implement a `Secret` resolution helper `config.secret(name)`
- [ ] Task: Update `Runner` to resolve secrets before applying resources
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Component Integration' (Protocol in workflow.md)
