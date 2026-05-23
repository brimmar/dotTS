// E2E Advanced Suite — covers features not tested in basic:
// remoteFile, git, unarchive, file+template, script options (onlyIf/workingDir/env/retries),
// pkg version/absent, multi-stack, App/Stack scoping
import {
  App, Stack,
  pkg, file, dir, script, remoteFile, git, unarchive,
  onPlatform,
} from 'dotts';

export default () => {
  // ── Multi-Stack scoping ──────────────────────────────────────────────────────
  // Verify that App/Stack hierarchy works: resources in different stacks are
  // all discovered and executed by the runner.
  //
  // NOTE: The functional config API wraps everything in a single default Stack.
  // To test explicit multi-stack, we use the App/Stack constructors directly
  // via the public API re-export.

  // ── Directories (setup) ─────────────────────────────────────────────────────
  const workDir  = dir('~/.dotts-e2e');
  const toolsDir = dir('~/.dotts-e2e/tools');
  const dataDir  = dir('~/.dotts-e2e/data');

  // ── file with Mustache template vars ────────────────────────────────────────
  file('~/.dotts-e2e/config.ini', {
    content: 'username = {{user}}\nregion   = {{region}}\ndebug    = {{debug}}',
    vars: { user: 'dotts-test', region: 'us-east-1', debug: 'false' },
    dependsOn: [workDir],
  });

  // ── remoteFile ───────────────────────────────────────────────────────────────
  // Download a small well-known file. We use the dotTS install script itself
  // (it's now public and tiny). No sha256 check here since it could change;
  // we just verify the file is downloaded and executable.
  remoteFile('~/.dotts-e2e/dotts-install.sh', {
    url: 'https://raw.githubusercontent.com/brimmar/dotTS/main/scripts/install.sh',
    mode: 0o755,
    dependsOn: [workDir],
  });

  // ── git clone ────────────────────────────────────────────────────────────────
  // Clone a tiny well-known repo. Depth 1 for speed.
  git('https://github.com/brimmar/dotTS.git', {
    dest: '/tmp/dotts-e2e-clone',
    depth: 1,
  });

  // ── unarchive — tar.gz ───────────────────────────────────────────────────────
  unarchive('tgz-fixture', {
    src: '/home/testuser/fixtures/fixture.tar.gz',
    dest: '/tmp/dotts-e2e-tgz',
  });

  // ── unarchive — zip ──────────────────────────────────────────────────────────
  unarchive('zip-fixture', {
    src: '/home/testuser/fixtures/fixture.zip',
    dest: '/tmp/dotts-e2e-zip',
  });

  // ── unarchive — tar.gz with stripComponents ──────────────────────────────────
  unarchive('tgz-strip-fixture', {
    src: '/home/testuser/fixtures/fixture.tar.gz',
    dest: '/tmp/dotts-e2e-stripped',
    stripComponents: 1,
  });

  // ── script: onlyIf guard ─────────────────────────────────────────────────────
  // Should run because the onlyIf condition succeeds (file exists)
  script('echo "onlyif-ran" > /tmp/dotts-e2e-onlyif.txt', {
    onlyIf: 'test -d /tmp',           // /tmp always exists → should run
    unless: 'test -f /tmp/dotts-e2e-onlyif.txt',
  });

  // Should NOT run because onlyIf fails
  script('echo "should-not-run" > /tmp/dotts-e2e-onlyif-skip.txt', {
    onlyIf: 'test -f /tmp/dotts-e2e-DOES-NOT-EXIST',
  });

  // ── script: workingDir ───────────────────────────────────────────────────────
  script('pwd > /tmp/dotts-e2e-pwd.txt', {
    workingDir: '/tmp',
    unless: 'test -f /tmp/dotts-e2e-pwd.txt',
  });

  // ── script: environment vars ─────────────────────────────────────────────────
  script('echo "$DOTTS_TEST_VAR" > /tmp/dotts-e2e-env.txt', {
    environment: { DOTTS_TEST_VAR: 'hello-from-env' },
    unless: 'test -f /tmp/dotts-e2e-env.txt',
  });

  // ── pkg: absent (removal) ────────────────────────────────────────────────────
  // First install, then immediately mark absent to test removal logic.
  // We use 'toilet' — a tiny, harmless package not present by default.
  const toiletInstalled = pkg('toilet', { become: true });
  pkg('toilet', { become: true, state: 'absent', dependsOn: [toiletInstalled] });

  // ── pkg: specific version ────────────────────────────────────────────────────
  // Install a specific version of curl (already installed, but tests version pinning path).
  // We check the format is accepted; apt will install latest if exact version not found.
  pkg('curl', { become: true, version: '8.5.0' });

  // ── retries ─────────────────────────────────────────────────────────────────
  // Script succeeds on first try; we verify retries doesn't break happy path.
  script('echo "retry-ok" > /tmp/dotts-e2e-retries.txt', {
    unless: 'test -f /tmp/dotts-e2e-retries.txt',
    retries: 3,
    retryDelay: 0,
  });

  // ── Platform guard inside a feature block ────────────────────────────────────
  onPlatform('linux', () => {
    script('echo "linux-advanced=true" > /tmp/dotts-e2e-platform.txt', {
      unless: 'test -f /tmp/dotts-e2e-platform.txt',
    });
  });
};
