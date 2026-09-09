import { createHash } from 'node:crypto';
import { describe, it, expect, beforeEach } from 'bun:test';
import { ActiveContext } from './core/context';
import { App, Stack } from './core/app';
import { pkg, file, link, dir, script, remoteFile, secret, onPlatform, onDistro, lineInFile } from './public';
import { PackageResource } from './resources/package';
import { FileResource } from './resources/file';
import { SymlinkResource } from './resources/symlink';
import { DirectoryResource } from './resources/directory';
import { ScriptResource } from './resources/script';
import { RemoteFileResource } from './resources/remote-file';
import { SecretToken } from './core/secret';

describe('Functional Helpers', () => {
  let stack: Stack;

  beforeEach(() => {
    const app = new App();
    stack = new Stack(app, 'test');
    ActiveContext.setStack(stack);
  });

  it('pkg() should create a PackageResource', () => {
    const res = pkg('git');
    expect(res).toBeInstanceOf(PackageResource);
    expect(stack.children.map((child) => child.id)).toContain(res.id);
  });

  it('file() should create a FileResource', () => {
    const res = file('/tmp/test', { content: 'hello' });
    expect(res).toBeInstanceOf(FileResource);
    expect(stack.children.map((child) => child.id)).toContain(res.id);
  });

  it('link() should create a SymlinkResource', () => {
    const res = link('/tmp/link', '/tmp/target');
    expect(res).toBeInstanceOf(SymlinkResource);
    expect(stack.children.map((child) => child.id)).toContain(res.id);
  });

  it('dir() should create a DirectoryResource', () => {
    const res = dir('/tmp/dir');
    expect(res).toBeInstanceOf(DirectoryResource);
    expect(stack.children.map((child) => child.id)).toContain(res.id);
  });

  it('script() should create a ScriptResource', () => {
    const res = script('echo ok');
    expect(res).toBeInstanceOf(ScriptResource);
    expect(stack.children.map((child) => child.id)).toContain(res.id);
  });

  it('remoteFile() should create a RemoteFileResource', () => {
    const res = remoteFile('/tmp/remote', { url: 'https://example.com' });
    expect(res).toBeInstanceOf(RemoteFileResource);
    expect(stack.children.map((child) => child.id)).toContain(res.id);
  });

  it('secret() should return a SecretToken', () => {
    const s = secret('API_KEY');
    expect(s).toBeInstanceOf(SecretToken);
    expect(s.name).toBe('API_KEY');
  });

  it('onPlatform() should execute callback only if OS matches', () => {
    ActiveContext.setPlatform({ os: 'darwin', arch: 'arm64' });
    
    let called = false;
    onPlatform('darwin', () => { called = true; });
    expect(called).toBe(true);

    called = false;
    onPlatform('linux', () => { called = true; });
    expect(called).toBe(false);
  });

  it('onDistro() should execute callback only if distro matches', () => {
    ActiveContext.setPlatform({ os: 'linux', arch: 'x64', distro: 'ubuntu' });
    
    let called = false;
    onDistro('ubuntu', () => { called = true; });
    expect(called).toBe(true);

    called = false;
    onDistro('arch', () => { called = true; });
    expect(called).toBe(false);
  });

  it('onPlatform() should support multiple OS matches', () => {
    ActiveContext.setPlatform({ os: 'linux', arch: 'x64' });
    
    let called = false;
    onPlatform(['darwin', 'linux'], () => { called = true; });
    expect(called).toBe(true);

    called = false;
    onPlatform(['darwin', 'win32'], () => { called = true; });
    expect(called).toBe(false);
  });

  it('onPlatform() api.pkg works when the OS matches', () => {
    ActiveContext.setPlatform({ os: 'darwin', arch: 'arm64' });

    let handle: ReturnType<typeof pkg> | undefined;
    onPlatform('darwin', (api) => {
      handle = api.pkg('git');
    });
    expect(handle).toBeInstanceOf(PackageResource);
    expect(handle?.id).toBe('pkg:git');

    handle = undefined;
    onPlatform('linux', (api) => {
      handle = api.pkg('git');
    });
    expect(handle).toBeUndefined();
  });

  it('onDistro() should support multiple distro matches', () => {
    ActiveContext.setPlatform({ os: 'linux', arch: 'x64', distro: 'ubuntu' });
    
    let called = false;
    onDistro(['ubuntu', 'debian'], () => { called = true; });
    expect(called).toBe(true);

    called = false;
    onDistro(['arch', 'fedora'], () => { called = true; });
    expect(called).toBe(false);
  });

  it('pkg() uses a stable colon-prefixed id', () => {
    const res = pkg('git');
    expect(res.id).toBe('pkg:git');
  });

  it('script() ids hash run plus stable props', () => {
    const a = script('echo hello');
    const b = script('echo hello');
    const c = script('echo hello;');
    const d = script('echo hello', { workingDir: '/tmp' });
    const payload = JSON.stringify(['echo hello', null, null, null, null]);
    const digest = createHash('sha256').update(payload).digest('hex').slice(0, 16);

    expect(a.id).toBe(b.id);
    expect(a.id).not.toBe(c.id);
    expect(a.id).not.toBe(d.id);
    expect(a.id).toBe(`script:${digest}`);
  });

  it('lineInFile() ids hash line, regexp, and flags as JSON', () => {
    const a = lineInFile('/tmp/f', 'ab', { regexp: 'c' });
    const b = lineInFile('/tmp/f', 'a', { regexp: 'bc' });
    const c = lineInFile('/tmp/f', 'ab', { regexp: /c/gi });
    const digest = createHash('sha256').update(JSON.stringify(['ab', 'c', null])).digest('hex').slice(0, 16);

    expect(a.id).not.toBe(b.id);
    expect(a.id).not.toBe(c.id);
    expect(a.id).toBe(`line:/tmp/f:${digest}`);
  });

  it('file(), link(), and dir() use path-based ids', () => {
    expect(file('/tmp/test', { content: 'hello' }).id).toBe('file:/tmp/test');
    expect(link('/tmp/link', '/tmp/target').id).toBe('link:/tmp/link');
    expect(dir('/tmp/dir').id).toBe('dir:/tmp/dir');
  });
});