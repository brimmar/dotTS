import { mkdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

export async function dottsInit(projectDir: string) {
  await mkdir(projectDir, { recursive: true });
  
  const publicPath = relative(projectDir, join(process.cwd(), 'src/public')).replace(/\\/g, '/');
  
  const content = `import { pkg, file, App } from '${publicPath}';

export default async (app: App) => {
  pkg('neovim');

  file('~/.gitconfig', {
    content: '[user]\n  name = My Name',
  });
};
`;
  
  await writeFile(join(projectDir, 'dotts.ts'), content);
}
