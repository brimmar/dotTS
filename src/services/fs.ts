import { Context, Effect, Layer } from 'effect';
import * as NodeFS from 'node:fs/promises';
import { dirname } from 'node:path';

export class FileSystem extends Context.Tag('FileSystem')<
  FileSystem,
  {
    readonly writeFile: (path: string, content: string) => Effect.Effect<void, Error>;
    readonly readFile: (path: string) => Effect.Effect<string, Error>;
    readonly exists: (path: string) => Effect.Effect<boolean, Error>;
    readonly mkdir: (path: string) => Effect.Effect<void, Error>;
    readonly symlink: (target: string, path: string) => Effect.Effect<void, Error>;
  }
>() {}

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
  })
);
