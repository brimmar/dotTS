import * as p from '@clack/prompts';
import { color } from 'console-log-colors';
import { Effect, Layer } from 'effect';
import { SystemCommand, SystemCommandLive } from '../services/exec';
import { FileSystem, FileSystemLive } from '../services/fs';
import { platform, release } from 'node:os';

export async function dottsDoctor() {
  p.log.step(color.cyan('Running system diagnostics...'));

  const program = Effect.gen(function* () {
    const exec = yield* SystemCommand;
    const fs = yield* FileSystem;

    // 1. OS Info
    p.log.info(color.gray(`OS: ${platform()} ${release()}`));

    // 2. Check tools
    const tools = ['bun', 'node', 'npm', 'git', 'brew', 'apt-get'];
    for (const tool of tools) {
      const result = yield* Effect.match(
        exec.run(`which ${tool}`),
        {
          onFailure: () => false,
          onSuccess: () => true,
        }
      );
      
      if (result) {
        p.log.info(`${color.green('✓')} ${tool} found`);
      } else {
        p.log.info(`${color.gray('○')} ${tool} not found`);
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

    if (writeResult === 'OK') {
      yield* fs.rm(testFile);
      p.log.info(`${color.green('✓')} Write access to current directory`);
    } else {
      p.log.error(`${color.red('✗')} No write access to current directory: ${writeResult}`);
    }

  });

  const MainLive = Layer.mergeAll(SystemCommandLive, FileSystemLive);
  
  await Effect.runPromise(Effect.provide(program, MainLive));
}
