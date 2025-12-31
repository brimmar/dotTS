import { Context, Effect, Layer } from 'effect';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export class SystemCommand extends Context.Tag('SystemCommand')< 
  SystemCommand,
  {
    readonly run: (command: string) => Effect.Effect<string, Error>;
  }
>() {}

export const SystemCommandLive = Layer.succeed(
  SystemCommand,
  SystemCommand.of({
    run: (command) =>
      Effect.tryPromise({
        try: async () => {
          const { stdout, stderr } = await execAsync(command);
          if (stderr) {
            // Some commands output to stderr even on success, but we'll treat it as part of output for now
            // Or strictly fail. For now, let's just return stdout + stderr?
            // Standard practice is usually to only fail if the process exit code is non-zero,
            // which execAsync does automatically (it throws).
          }
          return stdout;
        },
        catch: (error) => new Error(`Command failed: ${command}\n${String(error)}`),
      }),
  })
);
