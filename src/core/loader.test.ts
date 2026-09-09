import { afterEach, describe, expect, it } from 'bun:test';
import { exists, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PackageResource } from '../resources/package';
import { loadConfig } from './loader';

describe('loadConfig', () => {
  const testDir = join(tmpdir(), 'dotts-loader-test-' + Math.random().toString(36).slice(2));
  const projectRoot = resolve(process.cwd());

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('should load functional configuration via export default', async () => {
    const configPath = join(testDir, 'functional.ts');
    await mkdir(testDir, { recursive: true });
    await writeFile(
      configPath,
      `
      import { pkg } from '${join(projectRoot, 'src/public')}';
      export default (app) => {
        pkg('git');
      };
    `,
    );

    const { app } = await loadConfig(configPath);
    const resources = app.children[0]!.children;
    expect(resources.some((r) => r instanceof PackageResource && r.props.name === 'git')).toBe(true);
    expect(await exists(join(testDir, 'node_modules/dotts'))).toBe(false);
  });

  it("should resolve import { pkg } from 'dotts' without writing a package shim", async () => {
    const configPath = join(testDir, 'from-dotts.ts');
    await mkdir(testDir, { recursive: true });
    await writeFile(
      configPath,
      `
      import { pkg } from 'dotts';
      export default () => {
        pkg('curl');
      };
    `,
    );

    const { app } = await loadConfig(configPath);
    const resources = app.children[0]!.children;
    expect(resources.some((r) => r instanceof PackageResource && r.props.name === 'curl')).toBe(true);
    expect(await exists(join(testDir, 'node_modules/dotts'))).toBe(false);
  });

  it('should reject legacy export const config', async () => {
    const configPath = join(testDir, 'legacy.ts');
    await mkdir(testDir, { recursive: true });
    await writeFile(
      configPath,
      `
      export const config = {
        name: 'legacy-test',
        packages: [{ name: 'vim', manager: 'brew' }],
      };
    `,
    );

    await expect(loadConfig(configPath)).rejects.toThrow(
      'Configuration file must export a default function: export default () => { ... }',
    );
    expect(await exists(join(testDir, 'node_modules/dotts'))).toBe(false);
  });
});
