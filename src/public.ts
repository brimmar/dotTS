import { createHash } from 'node:crypto';
import { ActiveContext } from '@/core/context';
import { App as AppImpl, Stack as StackImpl } from '@/core/app';
import { PackageResource } from '@/resources/package';
import { FileResource } from '@/resources/file';
import { SymlinkResource } from '@/resources/symlink';
import { DirectoryResource } from '@/resources/directory';
import { ScriptResource } from '@/resources/script';
import { RemoteFileResource } from '@/resources/remote-file';
import { GitResource } from '@/resources/git';
import { LineInFileResource } from '@/resources/line-in-file';
import { ServiceResource } from '@/resources/service';
import { UserResource } from '@/resources/user';
import { GroupResource } from '@/resources/group';
import { AptRepositoryResource } from '@/resources/apt-repository';
import { UnarchiveResource } from '@/resources/unarchive';
import { secret as createSecret, SecretToken } from './core/secret';
import type {
  AptRepositoryProps,
  DirectoryProps,
  FileProps,
  GitProps,
  GroupProps,
  LineInFileProps,
  LinkProps,
  PackageProps,
  RemoteFileProps,
  ResourceHandle,
  ScriptProps,
  ServiceProps,
  UnarchiveProps,
  UserProps,
} from './public-props';

export type {
  AptRepositoryProps,
  DirectoryProps,
  FileProps,
  GitProps,
  GroupProps,
  LineInFileProps,
  LinkProps,
  PackageManager,
  PackageProps,
  RemoteFileProps,
  ResourceBaseProps,
  ResourceHandle,
  ScriptProps,
  ServiceProps,
  UnarchiveProps,
  UserProps,
} from './public-props';

export { SecretToken };

export class App {
  constructor() {
    return new AppImpl() as unknown as App;
  }
}

export class Stack {
  constructor(scope: App, id: string) {
    return new StackImpl(scope as never, id) as unknown as Stack;
  }
}

function stableHash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
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
export function pkg(name: string, props: PackageProps = {}): ResourceHandle {
  const stack = ActiveContext.requireStack();
  return new PackageResource(stack, `pkg:${name}`, { ...props, name } as never);
}

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
export function file(path: string, props: FileProps): ResourceHandle {
  const stack = ActiveContext.requireStack();
  return new FileResource(stack, `file:${path}`, { ...props, path } as never);
}

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
export function link(path: string, source: string, props: LinkProps = {}): ResourceHandle {
  const stack = ActiveContext.requireStack();
  return new SymlinkResource(stack, `link:${path}`, { ...props, path, source } as never);
}

/**
 * Ensures a directory exists at the given path.
 * @param path Directory to create.
 * @param props Optional mode, ownership, and shared resource options.
 * @example
 * ```ts
 * dir('~/.config/myapp');
 * ```
 */
export function dir(path: string, props: DirectoryProps = {}): ResourceHandle {
  const stack = ActiveContext.requireStack();
  return new DirectoryResource(stack, `dir:${path}`, { ...props, path } as never);
}

/**
 * Runs a shell command. The resource id is a hash of `run` plus stable props
 * (`workingDir`, `unless`, `onlyIf`, `become`), so the same command in a
 * different directory does not collide.
 * @param run Command to execute.
 * @param props Optional `unless`, `onlyIf`, working directory, and env vars.
 * @example
 * ```ts
 * script('jq --version > /tmp/jq-version.txt', {
 *   unless: 'test -f /tmp/jq-version.txt',
 * });
 * ```
 */
export function script(run: string, props: ScriptProps = {}): ResourceHandle {
  const stack = ActiveContext.requireStack();
  const id = `script:${stableHash(
    JSON.stringify([run, props.workingDir ?? null, props.unless ?? null, props.onlyIf ?? null, props.become ?? null]),
  )}`;
  return new ScriptResource(stack, id, { ...props, run } as never);
}

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
export function remoteFile(path: string, props: RemoteFileProps): ResourceHandle {
  const stack = ActiveContext.requireStack();
  return new RemoteFileResource(stack, `remote:${path}`, { ...props, path } as never);
}

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
export function git(url: string, props: GitProps): ResourceHandle {
  const stack = ActiveContext.requireStack();
  return new GitResource(stack, `git:${props.dest}`, { ...props, url } as never);
}

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
export function lineInFile(path: string, line: string, props: LineInFileProps = {}): ResourceHandle {
  const stack = ActiveContext.requireStack();
  const regexp = props.regexp;
  const pattern = regexp instanceof RegExp ? regexp.source : (regexp ?? null);
  const flags = regexp instanceof RegExp ? regexp.flags : null;
  const id = `line:${path}:${stableHash(JSON.stringify([line, pattern, flags]))}`;
  return new LineInFileResource(stack, id, { ...props, path, line } as never);
}

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
export function service(name: string, props: ServiceProps = {}): ResourceHandle {
  const stack = ActiveContext.requireStack();
  return new ServiceResource(stack, `service:${name}`, { ...props, name } as never);
}

/**
 * Manages a login user.
 * @param name Account name.
 * @param props Optional uid, groups, shell, home directory, and present/absent state.
 * @example
 * ```ts
 * user('deploy', { shell: '/bin/bash', createHome: true });
 * ```
 */
export function user(name: string, props: UserProps = {}): ResourceHandle {
  const stack = ActiveContext.requireStack();
  return new UserResource(stack, `user:${name}`, { ...props, name } as never);
}

/**
 * Manages a system group.
 * @param name Group name.
 * @param props Optional gid and present/absent state.
 * @example
 * ```ts
 * group('docker');
 * ```
 */
export function group(name: string, props: GroupProps = {}): ResourceHandle {
  const stack = ActiveContext.requireStack();
  return new GroupResource(stack, `group:${name}`, { ...props, name } as never);
}

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
export function aptRepository(name: string, props: AptRepositoryProps): ResourceHandle {
  const stack = ActiveContext.requireStack();
  return new AptRepositoryResource(stack, `apt-repo:${name}`, { ...props, name } as never);
}

/**
 * Extracts an archive to a destination directory.
 * @param id Stable id fragment used as `unarchive:${id}`.
 * @param props Archive path, destination, and optional strip/mode/ownership.
 * @example
 * ```ts
 * unarchive('tools', { src: '~/tools.tar.gz', dest: '~/.local/opt/tools' });
 * ```
 */
export function unarchive(id: string, props: UnarchiveProps): ResourceHandle {
  const stack = ActiveContext.requireStack();
  return new UnarchiveResource(stack, `unarchive:${id}`, props as never);
}

/**
 * Returns a token that stands in for a named secret in file templates.
 * @param name Secret name stored by `dotts secrets`.
 * @example
 * ```ts
 * file('~/.npmrc', { content: secret('NPM_TOKEN') });
 * ```
 */
export function secret(name: string): SecretToken {
  return createSecret(name);
}

export type OS = 'linux' | 'darwin' | 'win32' | 'freebsd' | 'openbsd' | 'aix' | 'sunos' | 'android';
export type Distro =
  | 'ubuntu'
  | 'debian'
  | 'arch'
  | 'fedora'
  | 'centos'
  | 'rhel'
  | 'alpine';

export type DarwinManagers = 'brew' | 'bun' | 'npm' | 'cargo' | 'pip';
export type LinuxManagers = 'apt' | 'pacman' | 'bun' | 'npm' | 'cargo' | 'pip';
export type DebianDistro = 'ubuntu' | 'debian';
export type ArchDistro = 'arch';

export interface CommonApi {
  file: typeof file;
  link: typeof link;
  dir: typeof dir;
  script: typeof script;
  remoteFile: typeof remoteFile;
  git: typeof git;
  lineInFile: typeof lineInFile;
  unarchive: typeof unarchive;
  secret: typeof secret;
}

export interface DarwinApi extends CommonApi {
  pkg: (name: string, props?: Omit<PackageProps, 'manager'> & { manager?: DarwinManagers }) => ResourceHandle;
}

export interface LinuxApi extends CommonApi {
  pkg: (name: string, props?: Omit<PackageProps, 'manager'> & { manager?: LinuxManagers }) => ResourceHandle;
  service: typeof service;
  user: typeof user;
  group: typeof group;
  aptRepository: typeof aptRepository;
}

export type ArchApi = Omit<LinuxApi, 'aptRepository'>;

export type ApiFor<O extends OS> = O extends 'darwin' ? DarwinApi : O extends 'linux' ? LinuxApi : CommonApi;

export type DistroApiFor<D extends Distro> = D extends DebianDistro ? LinuxApi : ArchApi;

const platformApi = {
  file,
  link,
  dir,
  script,
  remoteFile,
  git,
  lineInFile,
  unarchive,
  secret,
  pkg,
  service,
  user,
  group,
  aptRepository,
};

/**
 * Run `fn` only on the given OS. Use the `api` argument for platform-narrowed helpers.
 * Global helpers such as `pkg` stay un-narrowed; narrowing is opt-in via `api`.
 * Mixed OS lists receive `CommonApi` only.
 * @param os One OS name or a list of names.
 * @param fn Code that declares resources for that OS.
 * @example
 * ```ts
 * onPlatform('darwin', (d) => {
 *   d.pkg('iterm2', { manager: 'brew' });
 * });
 * ```
 */
export function onPlatform(os: OS[], fn: (api: CommonApi) => void | Promise<void>): void;
export function onPlatform<O extends OS>(os: O, fn: (api: ApiFor<O>) => void | Promise<void>): void;
export function onPlatform(os: OS | OS[], fn: (api: typeof platformApi) => void | Promise<void>): void {
  const platform = ActiveContext.getPlatform();
  if (!platform) return;

  const matches = Array.isArray(os) ? os.includes(platform.os as OS) : platform.os === os;
  if (matches) {
    fn(platformApi);
  }
}

/**
 * Run `fn` only on the given Linux distro. Use the `api` argument for distro-narrowed helpers.
 * Unknown distros never match. Mixed distro lists receive `CommonApi` only.
 * @param distro One distro name or a list of names.
 * @param fn Code that declares resources for that distro.
 * @example
 * ```ts
 * onDistro('ubuntu', (d) => {
 *   d.aptRepository('nodejs', {
 *     uri: 'https://deb.nodesource.com/node_22.x',
 *     distribution: 'nodistro',
 *     components: ['main'],
 *   });
 * });
 * ```
 */
export function onDistro(distro: Distro[], fn: (api: CommonApi) => void | Promise<void>): void;
export function onDistro<D extends Distro>(distro: D, fn: (api: DistroApiFor<D>) => void | Promise<void>): void;
export function onDistro(distro: Distro | Distro[], fn: (api: typeof platformApi) => void | Promise<void>): void {
  const platform = ActiveContext.getPlatform();
  if (!platform || !platform.distro) return;

  const wanted = Array.isArray(distro) ? distro : [distro];
  const matches = (wanted as readonly string[]).includes(platform.distro);
  if (matches) {
    fn(platformApi);
  }
}
