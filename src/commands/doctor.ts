import * as p from '@clack/prompts';
import pc from 'picocolors';
import { Effect, Layer } from 'effect';
import { SystemCommand, SystemCommandLive } from '../services/exec';
import { FileSystem, FileSystemLive } from '../services/fs';
import { platform, release } from 'node:os';

export interface DoctorOptions {
  json?: boolean;
}

export interface DoctorResult {
  success: boolean;
  command: "doctor";
  os: { platform: string; release: string };
  tools: Record<string, boolean>;
  writeAccess: boolean;
}

export async function dottsDoctor(
  options: DoctorOptions = {},
): Promise<DoctorResult> {
  if (!options.json) {
    p.log.step(pc.cyan('Running system diagnostics...'));
  }

  const program = Effect.gen(function* () {
    const exec = yield* SystemCommand;
    const fs = yield* FileSystem;

    // 1. OS Info
    const osInfo = { platform: platform(), release: release() };
    if (!options.json) {
      p.log.info(pc.gray(`OS: ${osInfo.platform} ${osInfo.release}`));
    }

    // 2. Check tools
    const toolsToCheck = ['bun', 'node', 'npm', 'git', 'brew', 'apt-get'];
    const tools: Record<string, boolean> = {};
    for (const tool of toolsToCheck) {
      const result = yield* Effect.match(
        exec.run(`which ${tool}`, { intent: 'read' }),
        {
          onFailure: () => false,
          onSuccess: () => true,
        }
      );
      tools[tool] = result;
      
      if (!options.json) {
        if (result) {
          p.log.info(`${pc.green('✓')} ${tool} found`);
        } else {
          p.log.info(`${pc.gray('○')} ${tool} not found`);
        }
      }
    }

    // 3. Permissions check
    const cwd = process.cwd();
    const testFile = `${cwd}/.dotts-write-test`;
    const writeResult = yield* Effect.match(
      fs.writeFile(testFile, 'test'),
      {
        onFailure: (e) => `Failed: ${e.message}`,
        onSuccess: () => 'OK',
      }
    );

    let writeAccess = false;
    if (writeResult === 'OK') {
      yield* fs.rm(testFile);
      writeAccess = true;
      if (!options.json) {
        p.log.info(`${pc.green('✓')} Write access to current directory`);
      }
    } else {
      if (!options.json) {
        p.log.error(`${pc.red('✗')} No write access to current directory: ${writeResult}`);
      }
    }

    return {
      success: writeAccess,
      command: 'doctor' as const,
      os: osInfo,
      tools,
      writeAccess,
    };
  });

  const MainLive = FileSystemLive.pipe(Layer.provideMerge(SystemCommandLive));
  
  return await Effect.runPromise(Effect.provide(program, MainLive));
}
