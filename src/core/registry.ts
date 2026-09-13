import { Component, Resource } from './component';
import { PackageResource, type PackageResourceProps } from '../resources/package';
import { FileResource, type FileResourceProps } from '../resources/file';
import { SymlinkResource, type SymlinkResourceProps } from '../resources/symlink';
import { DirectoryResource, type DirectoryResourceProps } from '../resources/directory';
import { ScriptResource, type ScriptResourceProps } from '../resources/script';
import { RemoteFileResource, type RemoteFileResourceProps } from '../resources/remote-file';
import { GitResource, type GitResourceProps } from '../resources/git';
import { LineInFileResource, type LineInFileProps } from '../resources/line-in-file';
import { ServiceResource, type ServiceProps } from '../resources/service';
import { UserResource, type UserProps } from '../resources/user';
import { GroupResource, type GroupProps } from '../resources/group';
import { AptRepositoryResource, type AptRepositoryProps } from '../resources/apt-repository';
import { UnarchiveResource, type UnarchiveResourceProps } from '../resources/unarchive';

export type ResourceFactory = (
  scope: Component,
  id: string,
  metadata: Record<string, unknown>,
) => Resource;

function asProps<T>(metadata: Record<string, unknown>): T {
  return metadata as unknown as T;
}

export const resourceFactories: Record<string, ResourceFactory> = {
  pkg: (scope, id, metadata) => new PackageResource(scope, id, asProps<PackageResourceProps>(metadata)),
  file: (scope, id, metadata) => new FileResource(scope, id, asProps<FileResourceProps>(metadata)),
  link: (scope, id, metadata) => new SymlinkResource(scope, id, asProps<SymlinkResourceProps>(metadata)),
  dir: (scope, id, metadata) => new DirectoryResource(scope, id, asProps<DirectoryResourceProps>(metadata)),
  script: (scope, id, metadata) => new ScriptResource(scope, id, asProps<ScriptResourceProps>(metadata)),
  remote: (scope, id, metadata) => new RemoteFileResource(scope, id, asProps<RemoteFileResourceProps>(metadata)),
  git: (scope, id, metadata) => new GitResource(scope, id, asProps<GitResourceProps>(metadata)),
  line: (scope, id, metadata) => new LineInFileResource(scope, id, asProps<LineInFileProps>(metadata)),
  service: (scope, id, metadata) => new ServiceResource(scope, id, asProps<ServiceProps>(metadata)),
  user: (scope, id, metadata) => new UserResource(scope, id, asProps<UserProps>(metadata)),
  group: (scope, id, metadata) => new GroupResource(scope, id, asProps<GroupProps>(metadata)),
  'apt-repo': (scope, id, metadata) => new AptRepositoryResource(scope, id, asProps<AptRepositoryProps>(metadata)),
  unarchive: (scope, id, metadata) => new UnarchiveResource(scope, id, asProps<UnarchiveResourceProps>(metadata)),
};

export function registerResource(kind: string, factory: ResourceFactory) {
  resourceFactories[kind] = factory;
}

export function rehydrate(
  kind: string,
  id: string,
  metadata: Record<string, unknown>,
  scope: Component,
): Resource {
  const factory = resourceFactories[kind];
  if (!factory) {
    throw new Error(`Unknown resource kind: ${kind}`);
  }
  return factory(scope, id, metadata);
}
