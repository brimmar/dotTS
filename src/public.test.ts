import { describe, it, expect, beforeEach } from 'bun:test';
import { ActiveContext } from './core/context';
import { App, Stack } from './core/app';
import { pkg, file, link, dir, script, secret } from './public';
import { PackageResource } from './resources/package';
import { FileResource } from './resources/file';
import { SymlinkResource } from './resources/symlink';
import { DirectoryResource } from './resources/directory';
import { ScriptResource } from './resources/script';
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

  it('secret() should return a SecretToken', () => {
    const s = secret('API_KEY');
    expect(s).toBeInstanceOf(SecretToken);
    expect(s.name).toBe('API_KEY');
  });
});
