import { exists, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DottsError } from '../core/errors';
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
    pkg('build-essential');
  });

  file('~/.gitconfig', {
    content: ${'`'}[user]
  name = My Name
  email = my@email.com${'`'},
  });
};
`;

export async function dottsInit(projectDir: string, options: { force?: boolean } = {}) {
  await mkdir(projectDir, { recursive: true });
  const configPath = join(projectDir, 'dotts.ts');
  if (!options.force && (await exists(configPath))) {
    throw new DottsError(
      `Refusing to overwrite existing ${configPath}`,
      'Pass --force to re-initialize, or use a different directory.',
    );
  }
  await writeFile(configPath, DOTTS_TEMPLATE);
  await writeFile(join(projectDir, '.gitignore'), GITIGNORE);
  await writeFile(join(projectDir, 'tsconfig.json'), tsconfigJson());
  await dottsPrepare(projectDir);
}
