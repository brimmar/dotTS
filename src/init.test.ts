import { describe, expect, it, afterEach } from 'bun:test';
import { rm, exists } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { dottsInit } from './commands/init';

describe('dotts init', () => {
  const testProjectDir = join(tmpdir(), 'dotts-test-project-' + Math.random().toString(36).slice(2));

  afterEach(async () => {
    if (await exists(testProjectDir)) {
      await rm(testProjectDir, { recursive: true, force: true });
    }
  });

    it('should create a project directory and a dotts.ts file', async () => {

      await dottsInit(testProjectDir);

      

      expect(await exists(testProjectDir)).toBe(true);

      const configPath = join(testProjectDir, 'dotts.ts');

      expect(await exists(configPath)).toBe(true);

  

      const content = await Bun.file(configPath).text();

      expect(content).toContain('import { pkg, file, onPlatform, onDistro, App }');

      expect(content).toContain('onPlatform(\'darwin\'');

      expect(content).toContain('onDistro(\'ubuntu\'');

    });

  });

  