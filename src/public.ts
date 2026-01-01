import { ActiveContext } from './core/context';
import { PackageResource, PackageResourceProps } from './resources/package';
import { FileResource, FileResourceProps } from './resources/file';
import { SymlinkResource } from './resources/symlink';
import { DirectoryResource, DirectoryResourceProps } from './resources/directory';
import { ScriptResource, ScriptResourceProps } from './resources/script';
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

export const secret = secretTokenHelper;
