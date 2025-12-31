import { Context, Effect, Layer } from 'effect';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export interface SystemCommand {
  readonly run: (command: string) => Effect.Effect<string, Error>;
}

export const SystemCommand = Context.GenericTag<SystemCommand>('SystemCommand');

export const SystemCommandLive = Layer.succeed(
  SystemCommand,
  SystemCommand.of({
    run: (command) =>
      Effect.tryPromise({
        try: async () => {
          const { stdout } = await execAsync(command);
          return stdout.trim();
        },
        catch: (error) => new Error(`Command failed: ${command}\n${String(error)}`),
      }),
  })
);