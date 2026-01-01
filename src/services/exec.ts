import { Context, Effect, Layer } from 'effect';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export interface RunOptions {
  cwd?: string;
  env?: Record<string, string>;
}

export interface SystemCommand {
  readonly run: (command: string, options?: RunOptions) => Effect.Effect<string, Error>;
}

export const SystemCommand = Context.GenericTag<SystemCommand>('SystemCommand');

export const SystemCommandLive = Layer.succeed(
  SystemCommand,
  SystemCommand.of({
    run: (command, options) =>
      Effect.tryPromise({
        try: async () => {
          const { stdout } = await execAsync(command, {
            cwd: options?.cwd,
            env: options?.env ? { ...process.env, ...options.env } : process.env,
          });
          return stdout.trim();
        },
        catch: (error) => new Error(`Command failed: ${command}\n${String(error)}`),
      }),
  })
);
