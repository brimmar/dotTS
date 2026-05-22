import { Context, Effect, Layer } from 'effect';
import * as NodeFS from 'node:fs/promises';
import { dirname } from 'node:path';

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
}

export const FileSystem = Context.GenericTag<FileSystem>('FileSystem');

import { SystemCommand } from './exec';

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
      writeFile: (path, content, options) =>
        wrap(
          options,
          () => NodeFS.writeFile(path, content, 'utf-8'),
          (exec) => exec.run(`tee ${path} << 'EOF'\n${content}\nEOF`, options).pipe(Effect.map(() => undefined)),
          (error) => `Failed to write file ${path}: ${String(error)}`
        ),
      readFile: (path, options) =>
        wrap(
          options,
          () => NodeFS.readFile(path, 'utf-8'),
          (exec) => exec.run(`cat ${path}`, options),
          (error) => `Failed to read file ${path}: ${String(error)}`
        ),
      exists: (path, options) =>
        wrap(
          options,
          async () => {
            try {
              await NodeFS.access(path);
              return true;
            } catch {
              return false;
            }
          },
          (exec) =>
            exec.run(`test -e ${path}`, options).pipe(
              Effect.map(() => true),
              Effect.catchAll(() => Effect.succeed(false))
            ),
          (error) => `Failed to check existence of ${path}: ${String(error)}`
        ),
      mkdir: (path, options) =>
        wrap(
          options,
          () => NodeFS.mkdir(path, { recursive: true }).then(() => undefined),
          (exec) => exec.run(`mkdir -p ${path}`, options).pipe(Effect.map(() => undefined)),
          (error) => `Failed to create directory ${path}: ${String(error)}`
        ),
      symlink: (target, path, options) =>
        wrap(
          options,
          async () => {
            await NodeFS.mkdir(dirname(path), { recursive: true });
            try {
              await NodeFS.unlink(path);
            } catch {}
            await NodeFS.symlink(target, path);
          },
          (exec) =>
            Effect.gen(function* () {
              yield* exec.run(`mkdir -p ${dirname(path)}`, options);
              yield* exec.run(`ln -sf ${target} ${path}`, options);
            }),
          (error) => `Failed to create symlink ${path} -> ${target}: ${String(error)}`
        ),
      rm: (path, options) =>
        wrap(
          options,
          () => NodeFS.rm(path, { force: true, recursive: true }),
          (exec) => exec.run(`rm -rf ${path}`, options).pipe(Effect.map(() => undefined)),
          (error) => `Failed to remove ${path}: ${String(error)}`
        ),
      unlink: (path, options) =>
        wrap(
          options,
          () => NodeFS.unlink(path),
          (exec) => exec.run(`rm -f ${path}`, options).pipe(Effect.map(() => undefined)),
          (error) => `Failed to unlink ${path}: ${String(error)}`
        ),
      chmod: (path, mode, options) =>
        wrap(
          options,
          () => NodeFS.chmod(path, mode),
          (exec) => exec.run(`chmod ${mode.toString(8)} ${path}`, options).pipe(Effect.map(() => undefined)),
          (error) => `Failed to chmod ${path} to ${mode}: ${String(error)}`
        ),
      chown: (path, uid, gid, options) =>
        wrap(
          options,
          () => NodeFS.chown(path, uid, gid),
          (exec) => exec.run(`chown ${uid}:${gid} ${path}`, options).pipe(Effect.map(() => undefined)),
          (error) => `Failed to chown ${path} to ${uid}:${gid}: ${String(error)}`
        ),
    });
  })
);
