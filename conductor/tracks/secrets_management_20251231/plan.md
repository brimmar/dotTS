# Plan: Secrets Management

## Phase 1: Secret Storage & Encryption [checkpoint: 0c3c012]
- [x] Task: Implement a `SecretStore` service using Node's `crypto` module for encryption/decryption [46e6f69]
- [x] Task: Implement storage logic to save/load encrypted secrets from `.dotts/secrets.json` [fd7862f]
- [x] Task: Conductor - User Manual Verification 'Phase 1: Secret Storage' (Protocol in workflow.md)

## Phase 2: CLI Secret Management [checkpoint: 6c2fdb8]
- [x] Task: Add `secrets set` command to the CLI [78e4b7f]
- [x] Task: Add `secrets list` command to the CLI (masked output) [78e4b7f]
- [x] Task: Conductor - User Manual Verification 'Phase 2: CLI Secret Management' (Protocol in workflow.md)

## Phase 3: Component Integration
- [ ] Task: Implement a `Secret` resolution helper `config.secret(name)`
- [ ] Task: Update `Runner` to resolve secrets before applying resources
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Component Integration' (Protocol in workflow.md)
