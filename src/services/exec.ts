import { Context, Effect, Layer } from 'effect';
import { execFile as nodeExecFile } from 'node:child_process';

export interface ExecOptions {
  cwd?: string;
  env?: Record<string, string>;
  become?: boolean | string;
  stdin?: string;
}

export type RunOptions = ExecOptions;

export interface SystemCommand {
  readonly run: (command: string, options?: ExecOptions) => Effect.Effect<string, Error>;
  readonly execFile: (
    file: string,
    args: string[],
    options?: ExecOptions,
  ) => Effect.Effect<string, Error>;
}

export const SystemCommand = Context.GenericTag<SystemCommand>('SystemCommand');

/**
 * Prefix argv with sudo when `become` is set.
 * `true` / `'root'` → sudo without a username flag.
 * other username → sudo with `-u` then that user, then file and args.
 */
export function buildSudoArgs(
  file: string,
  args: string[],
  become?: boolean | string,
): { file: string; args: string[] } {
  if (!become) {
    return { file, args };
  }
  if (become === true || become === 'root') {
    return { file: 'sudo', args: [file, ...args] };
  }
  return { file: 'sudo', args: ['-u', become, file, ...args] };
}

function spawnExecFile(file: string, args: string[], options?: ExecOptions): Promise<string> {
  const spawned = buildSudoArgs(file, args, options?.become);
  const env = options?.env ? { ...process.env, ...options.env } : undefined;

  return new Promise((resolve, reject) => {
    const child = nodeExecFile(
      spawned.file,
      spawned.args,
      { cwd: options?.cwd, env, encoding: 'utf8' },
      (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(stdout.trim());
      },
    );
    if (options?.stdin !== undefined) {
      child.stdin?.write(options.stdin);
      child.stdin?.end();
    }
  });
}

export const SystemCommandLive = Layer.succeed(
  SystemCommand,
  SystemCommand.of({
    execFile: (file, args, options) =>
      Effect.tryPromise({
        try: () => spawnExecFile(file, args, options),
        catch: (error) => new Error(`Command failed: ${file} ${args.join(' ')}\n${String(error)}`),
      }),
    run: (command, options) =>
      Effect.tryPromise({
        try: () => spawnExecFile('sh', ['-c', command], options),
        catch: (error) => new Error(`Command failed: ${command}\n${String(error)}`),
      }),
  }),
);
