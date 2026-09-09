import type { SecretToken } from './core/secret';

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

/** Constructor stubs used when tsconfig.npm.json remaps internal modules. */
export class ResourceStub {
  readonly id: string;
  constructor(_scope?: unknown, id: string = '', _props?: unknown) {
    this.id = id;
  }
}

export class ActiveContext {
  static requireStack(): ResourceStub {
    return new ResourceStub(undefined, 'stack');
  }

  static getPlatform(): { os: string; arch: string; distro?: string } | undefined {
    return undefined;
  }
}

export class App {
  constructor() {}
}

export class Stack {
  constructor(_scope: App, _id: string) {}
}

export {
  ResourceStub as PackageResource,
  ResourceStub as FileResource,
  ResourceStub as SymlinkResource,
  ResourceStub as DirectoryResource,
  ResourceStub as ScriptResource,
  ResourceStub as RemoteFileResource,
  ResourceStub as GitResource,
  ResourceStub as LineInFileResource,
  ResourceStub as ServiceResource,
  ResourceStub as UserResource,
  ResourceStub as GroupResource,
  ResourceStub as AptRepositoryResource,
  ResourceStub as UnarchiveResource,
};
