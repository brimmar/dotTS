import { mkdir, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

export async function dottsInit(projectDir: string) {
  await mkdir(projectDir, { recursive: true });
  
  const publicPath = relative(projectDir, join(process.cwd(), 'src/public')).split(sep).join('/');
  
  const b = String.fromCharCode(96);
  const content = `import { pkg, file, onPlatform, onDistro, App } from '${publicPath}';

export default async (app: App) => {
  // Common packages
  pkg('git');
  pkg('neovim');

  // Platform-specific configuration
  onPlatform('darwin', () => {
    pkg('iterm2');
  });

  onPlatform('linux', () => {
    pkg('tilix');
  });

  // Distribution-specific configuration
  onDistro('ubuntu', () => {
    pkg('build-essential');
  });

  // Managed files
  file('~/.gitconfig', {
    content: ${b}[user]
  name = My Name
  email = my@email.com${b},
  });
};
`;
  
  await writeFile(join(projectDir, 'dotts.ts'), content);
}
