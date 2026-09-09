import { Context, Effect, Layer } from 'effect';
import * as NodeFS from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { homedir, tmpdir } from 'node:os';

export interface FileSystem {
  readonly writeFile: (path: string, content: string, options?: { become?: boolean | string }) => Effect.Effect<void, Error>;
  readonly readFile: (path: string, options?: { become?: boolean | string }) => Effect.Effect<string, Error>;
  readonly exists: (path: string, options?: { become?: boolean | string }) => Effect.Effect<boolean, Error>;
  readonly mkdir: (path: string, options?: { become?: boolean | string }) => Effect.Effect<void, Error>;
  readonly symlink: (target: string, path: string, options?: { become?: boolean | string }) => Effect.Effect<void, Error>;
  readonly rm: (path: string, options?: { become?: boolean | string }) => Effect.Effect<void, Error>;
  readonly unlink: (path: string, options?: { become?: boolean | string }) => Effect.Effect<void, Error>;
  readonly chmod: (path: string, mode: number, options?: { become?: boolean | string }) => Effect.Effect<void, Error>;
  readonly chown: (path: string, uid: number, gid: number, options?: { become?: boolean | string }) => Effect.Effect<void, Error>;
  readonly writeFileBytes: (
    path: string,
    content: Uint8Array,
    options?: { become?: boolean | string },
  ) => Effect.Effect<void, Error>;
}

export const FileSystem = Context.GenericTag<FileSystem>('FileSystem');

import { SystemCommand } from './exec';

/**
 * Expand leading `~` to the current user's home directory.
 * Node.js filesystem APIs do not do shell-style tilde expansion, so we must
 * handle it explicitly — otherwise paths like `~/.config/nvim` are treated
 * as a literal directory starting with `~`.
 */
function resolvePath(p: string): string {
  if (p === '~') return homedir();
  if (p.startsWith('~/') || p.startsWith('~\\')) return `${homedir()}${p.slice(1)}`;
  return resolve(p);
}

function unlinkTemp(temp: string) {
  return Effect.ignore(Effect.tryPromise(() => NodeFS.unlink(temp)));
}

function copyViaTemp(
  exec: SystemCommand,
  dest: string,
  content: string | Uint8Array,
  options?: { become?: boolean | string },
) {
  const temp = `${tmpdir()}/dotts-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return Effect.tryPromise({
    try: () => NodeFS.writeFile(temp, content, { mode: 0o600 }),
    catch: (error) => new Error(`Failed to write temp file ${temp}: ${String(error)}`),
  }).pipe(
    Effect.flatMap(() => exec.execFile('cp', [temp, dest], options)),
    Effect.map(() => undefined),
    Effect.ensuring(unlinkTemp(temp)),
  );
}

export const FileSystemLive = Layer.effect(
  FileSystem,
  Effect.gen(function* () {
    const exec = yield* SystemCommand;

    const wrap = <A, E, R>(
      options: { become?: boolean | string } | undefined,
      nodeOp: () => Promise<A>,
      sudoOp: (exec: SystemCommand) => Effect.Effect<A, E, R>,
      errorMsg: (err: any) => string
    ): Effect.Effect<A, Error | E, R> => {
      if (options?.become) {
        return sudoOp(exec);
      }
      return Effect.tryPromise({
        try: nodeOp,
        catch: (error) => new Error(errorMsg(error)),
      });
    };

    return FileSystem.of({
      writeFile: (path, content, options) => {
        const resolved = resolvePath(path);
        return wrap(
          options,
          () => NodeFS.writeFile(resolved, content, 'utf-8'),
          (exec) => copyViaTemp(exec, resolved, content, options),
          (error) => `Failed to write file ${resolved}: ${String(error)}`
        );
      },
      writeFileBytes: (path, content, options) => {
        const resolved = resolvePath(path);
        return wrap(
          options,
          () => NodeFS.writeFile(resolved, content),
          (exec) => copyViaTemp(exec, resolved, content, options),
          (error) => `Failed to write file ${resolved}: ${String(error)}`
        );
      },
      readFile: (path, options) => {
        const resolved = resolvePath(path);
        return wrap(
          options,
          () => NodeFS.readFile(resolved, 'utf-8'),
          (exec) => exec.execFile('cat', [resolved], options),
          (error) => `Failed to read file ${resolved}: ${String(error)}`
        );
      },
      exists: (path, options) => {
        const resolved = resolvePath(path);
        return wrap(
          options,
          async () => {
            try {
              await NodeFS.access(resolved);
              return true;
            } catch {
              return false;
            }
          },
          (exec) =>
            exec.execFile('test', ['-e', resolved], options).pipe(
              Effect.map(() => true),
              Effect.catchAll(() => Effect.succeed(false))
            ),
          (error) => `Failed to check existence of ${resolved}: ${String(error)}`
        );
      },
      mkdir: (path, options) => {
        const resolved = resolvePath(path);
        return wrap(
          options,
          () => NodeFS.mkdir(resolved, { recursive: true }).then(() => undefined),
          (exec) => exec.execFile('mkdir', ['-p', resolved], options).pipe(Effect.map(() => undefined)),
          (error) => `Failed to create directory ${resolved}: ${String(error)}`
        );
      },
      symlink: (target, path, options) => {
        const resolvedPath = resolvePath(path);
        // NOTE: target is intentionally NOT resolved — symlinks can be relative or
        // point to absolute paths specified by the user as-is.
        return wrap(
          options,
          async () => {
            await NodeFS.mkdir(dirname(resolvedPath), { recursive: true });
            try {
              await NodeFS.unlink(resolvedPath);
            } catch {}
            await NodeFS.symlink(target, resolvedPath);
          },
          (exec) =>
            Effect.gen(function* () {
              yield* exec.execFile('mkdir', ['-p', dirname(resolvedPath)], options);
              yield* exec.execFile('ln', ['-sf', target, resolvedPath], options);
            }),
          (error) => `Failed to create symlink ${resolvedPath} -> ${target}: ${String(error)}`
        );
      },
      rm: (path, options) => {
        const resolved = resolvePath(path);
        return wrap(
          options,
          () => NodeFS.rm(resolved, { force: true, recursive: true }),
          (exec) => exec.execFile('rm', ['-rf', resolved], options).pipe(Effect.map(() => undefined)),
          (error) => `Failed to remove ${resolved}: ${String(error)}`
        );
      },
      unlink: (path, options) => {
        const resolved = resolvePath(path);
        return wrap(
          options,
          () => NodeFS.unlink(resolved),
          (exec) => exec.execFile('rm', ['-f', resolved], options).pipe(Effect.map(() => undefined)),
          (error) => `Failed to unlink ${resolved}: ${String(error)}`
        );
      },
      chmod: (path, mode, options) => {
        const resolved = resolvePath(path);
        return wrap(
          options,
          () => NodeFS.chmod(resolved, mode),
          (exec) =>
            exec.execFile('chmod', [mode.toString(8), resolved], options).pipe(Effect.map(() => undefined)),
          (error) => `Failed to chmod ${resolved} to ${mode}: ${String(error)}`
        );
      },
      chown: (path, uid, gid, options) => {
        const resolved = resolvePath(path);
        return wrap(
          options,
          () => NodeFS.chown(resolved, uid, gid),
          (exec) =>
            exec.execFile('chown', [`${uid}:${gid}`, resolved], options).pipe(Effect.map(() => undefined)),
          (error) => `Failed to chown ${resolved} to ${uid}:${gid}: ${String(error)}`
        );
      },
    });
  })
);
