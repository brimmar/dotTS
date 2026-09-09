import { Context, Effect, Layer } from 'effect';
import { spawn } from 'node:child_process';

export interface ExecOptions {
  cwd?: string;
  env?: Record<string, string>;
  become?: boolean | string;
  stdin?: string;
  intent?: 'read' | 'write';
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
 * `true` / `'root'` → sudo -- file args.
 * other username → sudo -u user -- file args.
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
    return { file: 'sudo', args: ['--', file, ...args] };
  }
  return { file: 'sudo', args: ['-u', become, '--', file, ...args] };
}

function spawnExecFile(file: string, args: string[], options?: ExecOptions): Promise<string> {
  const spawned = buildSudoArgs(file, args, options?.become);
  const env = options?.env ? { ...process.env, ...options.env } : undefined;

  return new Promise((resolve, reject) => {
    const child = spawn(spawned.file, spawned.args, {
      cwd: options?.cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('error', fail);
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }
      const detail = stderr.trim() || stdout.trim();
      reject(
        new Error(
          `Command failed: ${spawned.file} ${spawned.args.join(' ')}${detail ? `\n${detail}` : ''}`,
        ),
      );
    });

    if (options?.stdin !== undefined) {
      child.stdin.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code !== 'EPIPE') fail(err);
      });
      child.stdin.end(options.stdin);
    } else {
      child.stdin.end();
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
