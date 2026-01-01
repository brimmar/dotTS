import { z } from 'zod';

export const PackageSchema = z.object({
  name: z.string(),
  manager: z.enum(['brew', 'apt', 'npm', 'pacman', 'bun', 'cargo', 'pip']).optional(),
  version: z.string().optional(),
});

export const SymlinkSchema = z.object({
  source: z.string(),
  path: z.string(),
});

export const FileSchema = z.object({
  path: z.string(),
  content: z.string(),
  vars: z.record(z.any()).optional(),
  mode: z.number().optional(),
  uid: z.number().optional(),
  gid: z.number().optional(),
});

export const DirectorySchema = z.object({
  path: z.string(),
  mode: z.number().optional(),
  uid: z.number().optional(),
  gid: z.number().optional(),
});

export const ScriptSchema = z.object({
  run: z.string(),
  unless: z.string().optional(),
  onlyIf: z.string().optional(),
  workingDir: z.string().optional(),
  environment: z.record(z.string()).optional(),
});

export const DottsSchema = z.object({
  name: z.string(),
  packages: z.array(PackageSchema).default([]),
  symlinks: z.array(SymlinkSchema).default([]),
  files: z.array(FileSchema).default([]),
  directories: z.array(DirectorySchema).default([]),
  scripts: z.array(ScriptSchema).default([]),
});

export type Package = z.infer<typeof PackageSchema>;
export type Symlink = z.infer<typeof SymlinkSchema>;
export type File = z.infer<typeof FileSchema>;
export type Dotts = z.infer<typeof DottsSchema>;
