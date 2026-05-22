import { describe, it, expect, afterEach } from 'bun:test';
import { rm, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfig } from './loader';
import { PackageResource } from '../resources/package';

describe('loadConfig', () => {
  const testDir = join(tmpdir(), 'dotts-loader-test-' + Math.random().toString(36).slice(2));
  const projectRoot = resolve(process.cwd());

  afterEach(async () => {
    // await rm(testDir, { recursive: true, force: true });
  });

  it('should load functional configuration via export default', async () => {
    const configPath = join(testDir, 'functional.ts');
    await mkdir(testDir, { recursive: true });
    await writeFile(configPath, `
      import { pkg } from '${join(projectRoot, 'src/public')}';
      export default (app) => {
        pkg('git');
      };
    `);

    const { app } = await loadConfig(configPath);
    const resources = app.children[0]!.children; // App -> Stack -> Resources
    expect(resources.some(r => r instanceof PackageResource && r.props.name === 'git')).toBe(true);
  });

  it('should still load legacy object configuration via export const config', async () => {
    const configPath = join(testDir, 'legacy.ts');
    await mkdir(testDir, { recursive: true });
    await writeFile(configPath, `
      export const config = {
        name: 'legacy-test',
        packages: [{ name: 'vim', manager: 'brew' }],
      };
    `);

    const { app, config } = await loadConfig(configPath);
    expect(config.name).toBe('legacy-test');
    const resources = app.children[0]!.children;
    expect(resources.some(r => r instanceof PackageResource && r.props.name === 'vim')).toBe(true);
  });
});