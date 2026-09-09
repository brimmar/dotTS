import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { dottsPrepare, tsconfigJson } from './prepare';

const GITIGNORE = `node_modules
.dotts/state.json
.dotts/secrets.json
`;

const DOTTS_TEMPLATE = `import { pkg, file, onPlatform, onDistro } from 'dotts';

export default () => {
  pkg('git');
  pkg('neovim');

  onPlatform('darwin', () => {
    pkg('iterm2');
  });

  onPlatform('linux', () => {
    pkg('tilix');
  });

  onDistro('ubuntu', () => {
    pkg('git');
  });

  file('~/.gitconfig', {
    content: ${'`'}[user]
  name = My Name
  email = my@email.com${'`'},
  });
};
`;

export async function dottsInit(projectDir: string) {
  await mkdir(projectDir, { recursive: true });
  await writeFile(join(projectDir, 'dotts.ts'), DOTTS_TEMPLATE);
  await writeFile(join(projectDir, '.gitignore'), GITIGNORE);
  await writeFile(join(projectDir, 'tsconfig.json'), tsconfigJson());
  await dottsPrepare(projectDir);
}
