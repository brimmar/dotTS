import { Context, Effect, Layer } from 'effect';
import { exec, execFile as nodeExecFile } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);
const execFileAsync = promisify(nodeExecFile);

export interface RunOptions {
  cwd?: string;
  env?: Record<string, string>;
  become?: boolean | string;
}

export interface SystemCommand {
  readonly run: (command: string, options?: RunOptions) => Effect.Effect<string, Error>;
  readonly execFile: (
    file: string,
    args: string[],
    options?: RunOptions,
  ) => Effect.Effect<string, Error>;
}

export const SystemCommand = Context.GenericTag<SystemCommand>('SystemCommand');

function sudoArgv(file: string, args: string[], become?: boolean | string): { file: string; args: string[] } {
  if (!become) return { file, args };
  const user = typeof become === 'string' ? become : 'root';
  return { file: 'sudo', args: ['-u', user, '--', file, ...args] };
}

export const SystemCommandLive = Layer.succeed(
  SystemCommand,
  SystemCommand.of({
    execFile: (file, args, options) =>
      Effect.tryPromise({
        try: async () => {
          const spawned = sudoArgv(file, args, options?.become);
          const { stdout } = await execFileAsync(spawned.file, spawned.args, {
            cwd: options?.cwd,
            env: options?.env ? { ...process.env, ...options.env } : process.env,
            encoding: 'utf8',
          });
          return stdout.trim();
        },
        catch: (error) => new Error(`Command failed: ${file} ${args.join(' ')}\n${String(error)}`),
      }),
    run: (command, options) =>
      Effect.tryPromise({
        try: async () => {
          let finalCommand = command;
          if (options?.become) {
            const user = typeof options.become === 'string' ? options.become : 'root';
            finalCommand = `sudo -u ${user} -- ${command}`;
          }
          const { stdout } = await execAsync(finalCommand, {
            cwd: options?.cwd,
            env: options?.env ? { ...process.env, ...options.env } : process.env,
          });
          return stdout.trim();
        },
        catch: (error) => new Error(`Command failed: ${command}\n${String(error)}`),
      }),
  })
);
