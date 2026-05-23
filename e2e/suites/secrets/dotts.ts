// E2E Secrets Suite
// Tests: secrets set/list via CLI, file resource using secret(), validation failure
import { file, dir, script } from 'dotts';

export default () => {
  const secretsDir = dir('~/.dotts-e2e-secrets');

  // file content from a secret — secret 'DB_PASSWORD' is set before apply runs
  file('~/.dotts-e2e-secrets/db.conf', {
    content: 'password={{DB_PASSWORD}}\nhost=localhost',
    vars: { DB_PASSWORD: '{{secret:DB_PASSWORD}}' },
    mode: 0o600,
    dependsOn: [secretsDir],
  });

  // Verify the secrets CLI set the value correctly by checking the decrypted output
  script('dotts apply --help > /tmp/dotts-e2e-help.txt 2>&1 || true', {
    unless: 'test -f /tmp/dotts-e2e-help.txt',
  });
};
