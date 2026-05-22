import { describe, it, expect, beforeEach } from 'bun:test';
import { ActiveContext } from './core/context';
import { App, Stack } from './core/app';
import { pkg, file, link, dir, script, remoteFile, secret, onPlatform, onDistro } from './public';
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
    expect(stack.children).toContain(res);
  });

  it('file() should create a FileResource', () => {
    const res = file('/tmp/test', { content: 'hello' });
    expect(res).toBeInstanceOf(FileResource);
    expect(stack.children).toContain(res);
  });

  it('link() should create a SymlinkResource', () => {
    const res = link('/tmp/link', '/tmp/target');
    expect(res).toBeInstanceOf(SymlinkResource);
    expect(stack.children).toContain(res);
  });

  it('dir() should create a DirectoryResource', () => {
    const res = dir('/tmp/dir');
    expect(res).toBeInstanceOf(DirectoryResource);
    expect(stack.children).toContain(res);
  });

  it('script() should create a ScriptResource', () => {
    const res = script('echo ok');
    expect(res).toBeInstanceOf(ScriptResource);
    expect(stack.children).toContain(res);
  });

  it('remoteFile() should create a RemoteFileResource', () => {
    const res = remoteFile('/tmp/remote', { url: 'https://example.com' });
    expect(res).toBeInstanceOf(RemoteFileResource);
    expect(stack.children).toContain(res);
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

  it('onDistro() should support multiple distro matches', () => {
    ActiveContext.setPlatform({ os: 'linux', arch: 'x64', distro: 'ubuntu' });
    
    let called = false;
    onDistro(['ubuntu', 'debian'], () => { called = true; });
    expect(called).toBe(true);

    called = false;
    onDistro(['arch', 'fedora'], () => { called = true; });
    expect(called).toBe(false);
  });
});