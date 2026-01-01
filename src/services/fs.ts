import { Context, Effect, Layer } from 'effect';
import * as NodeFS from 'node:fs/promises';
import { dirname } from 'node:path';

export interface FileSystem {
  readonly writeFile: (path: string, content: string) => Effect.Effect<void, Error>;
  readonly readFile: (path: string) => Effect.Effect<string, Error>;
  readonly exists: (path: string) => Effect.Effect<boolean, Error>;
  readonly mkdir: (path: string) => Effect.Effect<void, Error>;
  readonly symlink: (target: string, path: string) => Effect.Effect<void, Error>;
  readonly rm: (path: string) => Effect.Effect<void, Error>;
  readonly unlink: (path: string) => Effect.Effect<void, Error>;
  readonly chmod: (path: string, mode: number) => Effect.Effect<void, Error>;
  readonly chown: (path: string, uid: number, gid: number) => Effect.Effect<void, Error>;
}

export const FileSystem = Context.GenericTag<FileSystem>('FileSystem');

export const FileSystemLive = Layer.succeed(
  FileSystem,
  FileSystem.of({
    writeFile: (path, content) =>
      Effect.tryPromise({
        try: () => NodeFS.writeFile(path, content, 'utf-8'),
        catch: (error) => new Error(`Failed to write file ${path}: ${String(error)}`),
      }),
    readFile: (path) =>
      Effect.tryPromise({
        try: () => NodeFS.readFile(path, 'utf-8'),
        catch: (error) => new Error(`Failed to read file ${path}: ${String(error)}`),
      }),
    exists: (path) =>
      Effect.tryPromise({
        try: async () => {
          try {
            await NodeFS.access(path);
            return true;
          } catch {
            return false;
          }
        },
        catch: (error) => new Error(`Failed to check existence of ${path}: ${String(error)}`),
      }),
    mkdir: (path) =>
      Effect.tryPromise({
        try: () => NodeFS.mkdir(path, { recursive: true }),
        catch: (error) => new Error(`Failed to create directory ${path}: ${String(error)}`),
      }),
    symlink: (target, path) =>
      Effect.tryPromise({
        try: async () => {
           await NodeFS.mkdir(dirname(path), { recursive: true });
           // Force symlink creation for now (remove if exists)
           try { await NodeFS.unlink(path); } catch {} 
           await NodeFS.symlink(target, path);
        },
        catch: (error) => new Error(`Failed to create symlink ${path} -> ${target}: ${String(error)}`),
      }),
    rm: (path) =>
      Effect.tryPromise({
        try: () => NodeFS.rm(path, { force: true, recursive: true }),
        catch: (error) => new Error(`Failed to remove ${path}: ${String(error)}`),
      }),
    unlink: (path) =>
      Effect.tryPromise({
        try: () => NodeFS.unlink(path),
        catch: (error) => new Error(`Failed to unlink ${path}: ${String(error)}`),
      }),
    chmod: (path, mode) =>
      Effect.tryPromise({
        try: () => NodeFS.chmod(path, mode),
        catch: (error) => new Error(`Failed to chmod ${path} to ${mode}: ${String(error)}`),
      }),
    chown: (path, uid, gid) =>
      Effect.tryPromise({
        try: () => NodeFS.chown(path, uid, gid),
        catch: (error) => new Error(`Failed to chown ${path} to ${uid}:${gid}: ${String(error)}`),
      }),
  })
);
