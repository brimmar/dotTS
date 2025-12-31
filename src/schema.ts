import { z } from 'zod';

export const PackageSchema = z.object({
  name: z.string(),
  manager: z.enum(['brew', 'apt', 'pacman', 'bun', 'npm']).default('brew'),
});

export const SymlinkSchema = z.object({
  source: z.string(),
  target: z.string(),
});

export const FileSchema = z.object({
  path: z.string(),
  content: z.string(),
});

export const DottsSchema = z.object({
  name: z.string(),
  packages: z.array(PackageSchema).default([]),
  symlinks: z.array(SymlinkSchema).default([]),
  files: z.array(FileSchema).default([]),
});

export type Package = z.infer<typeof PackageSchema>;
export type Symlink = z.infer<typeof SymlinkSchema>;
export type File = z.infer<typeof FileSchema>;
export type Dotts = z.infer<typeof DottsSchema>;
