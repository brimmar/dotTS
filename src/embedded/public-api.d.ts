export declare class SecretToken {
  readonly name: string;
  constructor(name: string);
  toString(): string;
}

export interface ResourceHandle {
  readonly id: string;
}

export interface ResourceBaseProps {
  dependsOn?: ResourceHandle[];
  become?: boolean | string;
  retries?: number;
  retryDelay?: number;
}

export type PackageManager = 'brew' | 'apt' | 'npm' | 'pacman' | 'bun' | 'cargo' | 'pip';

export interface PackageProps extends ResourceBaseProps {
  manager?: PackageManager;
  version?: string;
}

export interface FileProps extends ResourceBaseProps {
  content: string | SecretToken;
  vars?: Record<string, unknown>;
  mode?: number;
  uid?: number;
  gid?: number;
}

export interface LinkProps extends ResourceBaseProps {
  source?: string;
  path?: string;
}

export interface DirectoryProps extends ResourceBaseProps {
  mode?: number;
  uid?: number;
  gid?: number;
}

export interface ScriptProps extends ResourceBaseProps {
  unless?: string;
  onlyIf?: string;
  workingDir?: string;
  environment?: Record<string, string>;
}

export interface RemoteFileProps extends ResourceBaseProps {
  url: string;
  sha256?: string;
  mode?: number;
  uid?: number;
  gid?: number;
}

export interface GitProps extends ResourceBaseProps {
  dest: string;
  branch?: string;
  sparse?: string[];
  depth?: number;
  recursive?: boolean;
}

export interface LineInFileProps extends ResourceBaseProps {
  regexp?: string | RegExp;
  state?: 'present' | 'absent';
}

export interface ServiceProps extends ResourceBaseProps {
  state?: 'started' | 'stopped' | 'restarted' | 'reloaded';
  enabled?: boolean;
}

export interface UserProps extends ResourceBaseProps {
  uid?: number;
  gid?: number | string;
  groups?: string[];
  shell?: string;
  home?: string;
  createHome?: boolean;
  state?: 'present' | 'absent';
}

export interface GroupProps extends ResourceBaseProps {
  gid?: number;
  state?: 'present' | 'absent';
}

export interface AptRepositoryProps extends ResourceBaseProps {
  uri: string;
  distribution: string;
  components: string[];
  key?: string;
  state?: 'present' | 'absent';
}

export interface UnarchiveProps extends ResourceBaseProps {
  src: string;
  dest: string;
  stripComponents?: number;
  mode?: number;
  uid?: number;
  gid?: number;
}

export declare class App {
  constructor();
}

export declare class Stack {
  constructor(scope: App, id: string);
}

/**
 * Declares a software package to install with the platform package manager.
 * @param name Package name as the manager knows it.
 * @param props Optional manager, version, and shared resource options.
 * @example
 * ```ts
 * pkg('git');
 * pkg('ripgrep', { manager: 'brew' });
 * ```
 */
export declare function pkg(name: string, props?: PackageProps): ResourceHandle;

/**
 * Writes a file at the given path, optionally rendering Mustache variables.
 * @param path Destination path, including `~` for the home directory.
 * @param props File content, optional template vars, mode, and ownership.
 * @example
 * ```ts
 * file('~/.gitconfig', {
 *   content: '[user]\n\tname = Ada\n',
 * });
 * ```
 */
export declare function file(path: string, props: FileProps): ResourceHandle;

/**
 * Creates a symbolic link at `path` pointing at `source`.
 * @param path Location of the symlink.
 * @param source Path the symlink should point to.
 * @param props Optional shared resource options such as `dependsOn`.
 * @example
 * ```ts
 * link('~/.config/nvim', '~/dotfiles/nvim');
 * ```
 */
export declare function link(path: string, source: string, props?: LinkProps): ResourceHandle;

/**
 * Ensures a directory exists at the given path.
 * @param path Directory to create.
 * @param props Optional mode, ownership, and shared resource options.
 * @example
 * ```ts
 * dir('~/.config/myapp');
 * ```
 */
export declare function dir(path: string, props?: DirectoryProps): ResourceHandle;

/**
 * Runs a shell command. The resource id is a hash of `run`, so the same command
 * always maps to the same id.
 * @param run Command to execute.
 * @param props Optional `unless`, `onlyIf`, working directory, and env vars.
 * @example
 * ```ts
 * script('jq --version > /tmp/jq-version.txt', {
 *   unless: 'test -f /tmp/jq-version.txt',
 * });
 * ```
 */
export declare function script(run: string, props?: ScriptProps): ResourceHandle;

/**
 * Downloads a remote file to `path`.
 * @param path Destination path.
 * @param props Source URL and optional sha256, mode, and ownership.
 * @example
 * ```ts
 * remoteFile('~/.local/bin/tool.sh', {
 *   url: 'https://example.com/tool.sh',
 *   mode: 0o755,
 * });
 * ```
 */
export declare function remoteFile(path: string, props: RemoteFileProps): ResourceHandle;

/**
 * Clones a git repository to `props.dest`.
 * @param url Repository URL.
 * @param props Destination path plus optional branch, depth, and sparse paths.
 * @example
 * ```ts
 * git('https://github.com/brimmar/dotTS.git', {
 *   dest: '/tmp/dotts',
 *   depth: 1,
 * });
 * ```
 */
export declare function git(url: string, props: GitProps): ResourceHandle;

/**
 * Ensures a line is present or absent in a file.
 * @param path File to edit.
 * @param line Line contents to add or remove.
 * @param props Optional regexp match, `present`/`absent` state, and shared options.
 * @example
 * ```ts
 * lineInFile('~/.bashrc', 'export DOTTS_MANAGED=1');
 * ```
 */
export declare function lineInFile(path: string, line: string, props?: LineInFileProps): ResourceHandle;

/**
 * Manages a systemd service.
 * @param name systemd unit name.
 * @param props Desired `started`/`stopped` state and whether the unit is enabled.
 * @remarks Only Linux systemd is supported. Apply fails on other operating systems.
 * @example
 * ```ts
 * service('sshd', { state: 'started', enabled: true });
 * ```
 */
export declare function service(name: string, props?: ServiceProps): ResourceHandle;

/**
 * Manages a login user.
 * @param name Account name.
 * @param props Optional uid, groups, shell, home directory, and present/absent state.
 * @example
 * ```ts
 * user('deploy', { shell: '/bin/bash', createHome: true });
 * ```
 */
export declare function user(name: string, props?: UserProps): ResourceHandle;

/**
 * Manages a system group.
 * @param name Group name.
 * @param props Optional gid and present/absent state.
 * @example
 * ```ts
 * group('docker');
 * ```
 */
export declare function group(name: string, props?: GroupProps): ResourceHandle;

/**
 * Adds or removes an apt source list entry.
 * @param name Short name used for the list and keyring files.
 * @param props Repository URI, distribution, components, and optional GPG key URL.
 * @remarks Only Debian and Ubuntu are supported.
 * @example
 * ```ts
 * aptRepository('nodejs', {
 *   uri: 'https://deb.nodesource.com/node_22.x',
 *   distribution: 'nodistro',
 *   components: ['main'],
 * });
 * ```
 */
export declare function aptRepository(name: string, props: AptRepositoryProps): ResourceHandle;

/**
 * Extracts an archive to a destination directory.
 * @param id Stable id fragment used as `unarchive:${id}`.
 * @param props Archive path, destination, and optional strip/mode/ownership.
 * @example
 * ```ts
 * unarchive('tools', { src: '~/tools.tar.gz', dest: '~/.local/opt/tools' });
 * ```
 */
export declare function unarchive(id: string, props: UnarchiveProps): ResourceHandle;

/**
 * Returns a token that stands in for a named secret in file templates.
 * @param name Secret name stored by `dotts secrets`.
 * @example
 * ```ts
 * file('~/.npmrc', { content: secret('NPM_TOKEN') });
 * ```
 */
export declare function secret(name: string): SecretToken;

export type OS = 'linux' | 'darwin' | 'win32' | 'freebsd' | 'openbsd' | 'aix' | 'sunos' | 'android';
export type Distro = 'ubuntu' | 'debian' | 'arch' | 'fedora' | 'centos' | 'rhel' | 'alpine';

/**
 * Runs `callback` only when the current OS matches.
 * @param os One OS name or a list of names.
 * @param callback Code that declares resources for that OS.
 * @example
 * ```ts
 * onPlatform('darwin', () => {
 *   pkg('iterm2');
 * });
 * ```
 */
export declare function onPlatform(os: OS | OS[], callback: () => void | Promise<void>): void;

/**
 * Runs `callback` only when the current Linux distro matches.
 * Unknown distros never match.
 * @param distro One distro name or a list of names.
 * @param callback Code that declares resources for that distro.
 * @example
 * ```ts
 * onDistro(['ubuntu', 'debian'], () => {
 *   pkg('build-essential');
 * });
 * ```
 */
export declare function onDistro(distro: Distro | Distro[], callback: () => void | Promise<void>): void;
