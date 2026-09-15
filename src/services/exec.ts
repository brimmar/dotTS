import { Context, Effect, Layer } from 'effect';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import pc from 'picocolors';

export interface ExecOptions {
  cwd?: string;
  env?: Record<string, string>;
  become?: boolean | string;
  stdin?: string;
  intent?: 'read' | 'write';
  verbose?: boolean;
  probe?: boolean;
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

export interface SystemCommandConfig {
  verbose?: boolean;
}

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

class LineStreamer {
  private buffer = '';
  constructor(
    private prefix: string,
    private color?: (s: string) => string,
  ) {}

  write(chunk: string) {
    this.buffer += chunk;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() ?? '';
    for (const line of lines) {
      const clean = line.split('\r').pop()?.trimEnd() ?? line;
      if (clean.length > 0) {
        const formatted = this.color ? this.color(clean) : clean;
        console.log(this.prefix + formatted);
      }
    }
  }

  flush() {
    if (this.buffer.length > 0) {
      const clean = this.buffer.split('\r').pop()?.trimEnd() ?? this.buffer;
      if (clean.length > 0) {
        const formatted = this.color ? this.color(clean) : clean;
        console.log(this.prefix + formatted);
      }
      this.buffer = '';
    }
  }
}

function formatCommandForLog(spawned: { file: string; args: string[] }): string {
  if (spawned.file === 'sudo') {
    const dashDashIndex = spawned.args.indexOf('--');
    if (dashDashIndex !== -1) {
      const sudoFlags = spawned.args.slice(0, dashDashIndex);
      const afterDash = spawned.args.slice(dashDashIndex + 1);
      const sudoPrefix = sudoFlags.length > 0 ? `sudo ${sudoFlags.join(' ')} ` : 'sudo ';
      if (afterDash[0] === 'sh' && afterDash[1] === '-c') {
        return `${sudoPrefix}${afterDash.slice(2).join(' ')}`;
      }
      return `${sudoPrefix}${afterDash.join(' ')}`;
    }
  }
  if (spawned.file === 'sh' && spawned.args[0] === '-c') {
    return spawned.args.slice(1).join(' ') || 'sh -c';
  }
  return `${spawned.file} ${spawned.args.join(' ')}`;
}

function spawnExecFile(
  file: string,
  args: string[],
  options?: ExecOptions,
  globalVerbose?: boolean,
): Promise<string> {
  const spawned = buildSudoArgs(file, args, options?.become);
  const env = options?.env ? { ...process.env, ...options.env } : undefined;
  const cwd = options?.cwd
    ? options.cwd === '~'
      ? homedir()
      : options.cwd.startsWith('~/') || options.cwd.startsWith('~\\')
        ? join(homedir(), options.cwd.slice(2))
        : options.cwd
    : undefined;

  const verbose = options?.verbose ?? globalVerbose ?? false;
  const shouldLog = verbose && options?.intent !== 'read' && !options?.probe;

  return new Promise((resolve, reject) => {
    if (shouldLog) {
      const displayCmd = formatCommandForLog(spawned);
      console.log(pc.dim('  $ ') + pc.cyan(displayCmd));
    }

    const stdoutStreamer = shouldLog ? new LineStreamer(pc.dim('  │ ')) : undefined;
    const stderrStreamer = shouldLog ? new LineStreamer(pc.dim('  │ '), pc.dim) : undefined;

    const child = spawn(spawned.file, spawned.args, {
      cwd,
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
      stdoutStreamer?.write(chunk);
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
      stderrStreamer?.write(chunk);
    });
    child.on('error', fail);
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      if (shouldLog) {
        stdoutStreamer?.flush();
        stderrStreamer?.flush();
        if (code !== 0) {
          console.log(pc.dim('  └─ exit ') + pc.red(String(code ?? 1)));
        }
      }
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

export function createSystemCommand(config?: SystemCommandConfig): SystemCommand {
  const isGlobalVerbose = config?.verbose ?? false;
  return SystemCommand.of({
    execFile: (file, args, options) =>
      Effect.tryPromise({
        try: () => spawnExecFile(file, args, options, isGlobalVerbose),
        catch: (error) =>
          new Error(`Command failed: ${file} ${args.join(' ')}\n${String(error)}`),
      }),
    run: (command, options) =>
      Effect.tryPromise({
        try: () => spawnExecFile('sh', ['-c', command], options, isGlobalVerbose),
        catch: (error) =>
          new Error(`Command failed: ${command}\n${String(error)}`),
      }),
  });
}

export function createSystemCommandLive(config?: SystemCommandConfig) {
  return Layer.succeed(SystemCommand, createSystemCommand(config));
}

export const SystemCommandLive = createSystemCommandLive();
