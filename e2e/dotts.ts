// E2E test configuration for dotts
// This exercises the most important resource types against a real Ubuntu system.
import { pkg, file, link, dir, script, lineInFile, onPlatform, onDistro } from 'dotts';

export default () => {
  // ── Packages ────────────────────────────────────────────────────────────────

  // Basic apt package install — become: true runs via sudo (real-world usage)
  const tree = pkg('tree', { become: true });
  const jq   = pkg('jq',   { become: true });

  // ── Directories ─────────────────────────────────────────────────────────────

  const configDir   = dir('~/.config/myapp');
  const scriptsDir  = dir('~/.local/bin');

  // ── Files ────────────────────────────────────────────────────────────────────

  // Write a plain config file
  const gitconfig = file('~/.gitconfig', {
    content: `[user]
\tname = Test User
\temail = test@example.com
[core]
\teditor = vim
`,
    dependsOn: [configDir],
  });

  // Write a file with template vars (tests the Mustache engine)
  const appConfig = file('~/.config/myapp/config.json', {
    content: JSON.stringify({ version: '0.1.0', debug: false }, null, 2),
    mode: 0o600,
    dependsOn: [configDir],
  });

  // ── Symlinks ─────────────────────────────────────────────────────────────────

  // Simulate symlinking a dotfile from a dotfiles repo
  link('~/.config/myapp/settings.json', '/home/testuser/dotfiles/settings.json');

  // ── line-in-file ─────────────────────────────────────────────────────────────

  // Idempotently ensure a line exists in ~/.bashrc
  lineInFile('~/.bashrc', 'export DOTTS_MANAGED=1');
  lineInFile('~/.bashrc', 'export PATH="$HOME/.local/bin:$PATH"');

  // ── Scripts ──────────────────────────────────────────────────────────────────

  // Only run if jq is actually installed (tests dependency ordering + unless)
  const jqVersion = script('jq --version > /tmp/dotts-jq-version.txt', {
    unless: 'test -f /tmp/dotts-jq-version.txt',
    dependsOn: [jq],
  });

  // Verify tree is installed
  script('tree --version > /tmp/dotts-tree-version.txt', {
    unless: 'test -f /tmp/dotts-tree-version.txt',
    dependsOn: [tree],
  });

  // ── Platform guards ──────────────────────────────────────────────────────────

  onPlatform('linux', () => {
    onDistro('ubuntu', () => {
      // Ubuntu-specific: verify we're on the right distro
      script('echo "ubuntu=true" > /tmp/dotts-distro-check.txt', {
        unless: 'test -f /tmp/dotts-distro-check.txt',
      });
    });
  });

  // This block should NOT execute in the container (it's linux, not darwin)
  onPlatform('darwin', () => {
    script('echo "should-not-run" > /tmp/dotts-darwin-error.txt');
  });
};
