import { describe, expect, it } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Effect } from 'effect';
import { dottsApply, dryRunFileSystem } from './commands/apply';
import { FileSystem, FileSystemLive } from './services/fs';
import { SystemCommandLive } from './services/exec';

describe('dotts apply', () => {
  const testDir = join(tmpdir(), 'dotts-apply-test-' + Math.random().toString(36).slice(2));

  it('should load and validate a dotts.ts file', async () => {
    const configPath = join(testDir, 'dotts-apply-ok.ts');
    await mkdir(testDir, { recursive: true });
    await writeFile(configPath, `
      export const config = {
        name: 'test-config',
        packages: [],
        symlinks: [],
        files: [],
        directories: [],
        scripts: []
      };
    `);

    // Note: dottsApply is an async function that handles its own Effect running
    // We expect it to work without additional wrapping
    await dottsApply(configPath);
  });

  it('should throw an error if dotts.ts is missing', async () => {
    expect(dottsApply(join(testDir, 'non-existent.ts'))).rejects.toThrow();
  });

  it('dry-run of file() does not create the file', async () => {
    const dir = join(tmpdir(), 'dotts-dry-run-file-' + Math.random().toString(36).slice(2));
    const target = join(dir, 'out.txt');
    const configPath = join(dir, 'dotts.ts');
    await mkdir(dir, { recursive: true });
    await writeFile(
      configPath,
      `
      export const config = {
        name: 'dry-run-file',
        packages: [],
        symlinks: [],
        files: [{ path: ${JSON.stringify(target)}, content: 'hello' }],
        directories: [],
        scripts: []
      };
    `,
    );

    await dottsApply(configPath, { dryRun: true });
    expect(existsSync(target)).toBe(false);
  });

  it('dry-run of file() does not write .dotts/state.json', async () => {
    const dir = join(tmpdir(), 'dotts-dry-run-state-' + Math.random().toString(36).slice(2));
    const target = join(dir, 'out.txt');
    const configPath = join(dir, 'dotts.ts');
    await mkdir(dir, { recursive: true });
    await writeFile(
      configPath,
      `
      export const config = {
        name: 'dry-run-state',
        packages: [],
        symlinks: [],
        files: [{ path: ${JSON.stringify(target)}, content: 'hello' }],
        directories: [],
        scripts: []
      };
    `,
    );

    const prev = process.cwd();
    process.chdir(dir);
    try {
      await dottsApply(configPath, { dryRun: true });
      expect(existsSync(join(dir, '.dotts', 'state.json'))).toBe(false);
    } finally {
      process.chdir(prev);
    }
  });
});

describe('dryRunFileSystem', () => {
  it('exists is live and writeFile does not change contents', async () => {
    const dir = join(tmpdir(), 'dotts-dry-fs-' + Math.random().toString(36).slice(2));
    const filePath = join(dir, 'existing.txt');
    await mkdir(dir, { recursive: true });
    await writeFile(filePath, 'original');

    const program = Effect.gen(function* () {
      const live = yield* FileSystem;
      const dry = dryRunFileSystem(live);
      const exists = yield* dry.exists(filePath);
      yield* dry.writeFile(filePath, 'changed');
      const content = yield* dry.readFile(filePath);
      return { exists, content };
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(FileSystemLive), Effect.provide(SystemCommandLive)),
    );

    expect(result.exists).toBe(true);
    expect(result.content).toBe('original');
    expect(readFileSync(filePath, 'utf8')).toBe('original');
  });
});
