import { ActiveContext } from './core/context';
import { PackageResource, type PackageResourceProps } from './resources/package';
import { FileResource, type FileResourceProps } from './resources/file';
import { SymlinkResource, type SymlinkResourceProps } from './resources/symlink';
import { DirectoryResource, type DirectoryResourceProps } from './resources/directory';
import { ScriptResource, type ScriptResourceProps } from './resources/script';
import { RemoteFileResource, type RemoteFileResourceProps } from './resources/remote-file';
import { GitResource, type GitResourceProps } from './resources/git';
import { LineInFileResource, type LineInFileProps } from './resources/line-in-file';
import { ServiceResource, type ServiceProps } from './resources/service';
import { UserResource, type UserProps } from './resources/user';
import { GroupResource, type GroupProps } from './resources/group';
import { AptRepositoryResource, type AptRepositoryProps } from './resources/apt-repository';
import { secret as secretTokenHelper } from './core/secret';
import { App, Stack } from './core/app';

export { App, Stack };

export function pkg(name: string, props: Omit<PackageResourceProps, 'name'> = {}) {
  const stack = ActiveContext.requireStack();
  return new PackageResource(stack, `pkg-${name}`, { ...props, name });
}

export function file(path: string, props: Omit<FileResourceProps, 'path'>) {
  const stack = ActiveContext.requireStack();
  return new FileResource(stack, `file-${path}`, { ...props, path });
}

export function link(path: string, source: string) {
  const stack = ActiveContext.requireStack();
  return new SymlinkResource(stack, `link-${path}`, { path, source });
}

export function dir(path: string, props: Omit<DirectoryResourceProps, 'path'> = {}) {
  const stack = ActiveContext.requireStack();
  return new DirectoryResource(stack, `dir-${path}`, { ...props, path });
}

export function script(run: string, props: Omit<ScriptResourceProps, 'run'> = {}) {
  const stack = ActiveContext.requireStack();
  return new ScriptResource(stack, `script-${run.slice(0, 20)}`, { ...props, run });
}

export function remoteFile(path: string, props: Omit<RemoteFileResourceProps, 'path'>) {
  const stack = ActiveContext.requireStack();
  return new RemoteFileResource(stack, `remote-${path}`, { ...props, path });
}

export function git(url: string, props: Omit<GitResourceProps, 'url'>) {
  const stack = ActiveContext.requireStack();
  return new GitResource(stack, `git-${props.dest}`, { ...props, url });
}

export function lineInFile(path: string, line: string, props: Omit<LineInFileProps, 'path' | 'line'> = {}) {
  const stack = ActiveContext.requireStack();
  return new LineInFileResource(stack, `line-${path}-${line.slice(0, 10)}`, { ...props, path, line });
}

export function service(name: string, props: Omit<ServiceProps, 'name'> = {}) {
  const stack = ActiveContext.requireStack();
  return new ServiceResource(stack, `service-${name}`, { ...props, name });
}

export function user(name: string, props: Omit<UserProps, 'name'> = {}) {
  const stack = ActiveContext.requireStack();
  return new UserResource(stack, `user-${name}`, { ...props, name });
}

export function group(name: string, props: Omit<GroupProps, 'name'> = {}) {
  const stack = ActiveContext.requireStack();
  return new GroupResource(stack, `group-${name}`, { ...props, name });
}

export function aptRepository(name: string, props: Omit<AptRepositoryProps, 'name'>) {
  const stack = ActiveContext.requireStack();
  return new AptRepositoryResource(stack, `apt-repo-${name}`, { ...props, name });
}

export const secret = secretTokenHelper;

export type OS = 'aix' | 'darwin' | 'freebsd' | 'linux' | 'openbsd' | 'sunos' | 'win32' | 'android';
export type Distro = 'ubuntu' | 'debian' | 'arch' | 'fedora' | 'centos' | 'rhel' | 'alpine' | string;

export function onPlatform(os: OS | OS[], callback: () => void | Promise<void>) {
  const platform = ActiveContext.getPlatform();
  if (!platform) return;

  const matches = Array.isArray(os) ? os.includes(platform.os as OS) : platform.os === os;
  if (matches) {
    callback();
  }
}

export function onDistro(distro: Distro | Distro[], callback: () => void | Promise<void>) {
  const platform = ActiveContext.getPlatform();
  if (!platform || !platform.distro) return;

  const matches = Array.isArray(distro) ? distro.includes(platform.distro) : platform.distro === distro;
  if (matches) {
    callback();
  }
}