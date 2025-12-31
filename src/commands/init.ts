import { mkdir, writeFile } from 'node:fs/promises';
import { join, basename } from 'node:path';

const template = `import { Dotts } from './src/schema';

export const config: Dotts = {
  name: '{PROJECT_NAME}',
  packages: [
    { name: 'neovim', manager: 'brew' },
  ],
  symlinks: [],
  files: [],
};
`;

export async function dottsInit(projectDir: string) {
  await mkdir(projectDir, { recursive: true });
  
  const projectName = basename(projectDir);
  const content = template.replace('{PROJECT_NAME}', projectName);
  
  await writeFile(join(projectDir, 'dotts.ts'), content);
}