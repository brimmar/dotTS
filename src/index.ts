import * as p from '@clack/prompts';
import { color } from 'console-log-colors';
import { dottsInit } from './commands/init';
import { dottsApply } from './commands/apply';
import { join } from 'node:path';

async function main() {
  p.intro(color.cyan(' dotts '));

  const command = await p.select({
    message: 'What would you like to do?',
    options: [
      { value: 'init', label: 'Initialize a new project', hint: 'dotts init' },
      { value: 'apply', label: 'Apply configuration', hint: 'dotts apply' },
      { value: 'exit', label: 'Exit' },
    ],
  });

  if (p.isCancel(command) || command === 'exit') {
    p.outro('Goodbye!');
    process.exit(0);
  }

  try {
    if (command === 'init') {
      const projectDir = await p.text({
        message: 'Where should the project be initialized?',
        placeholder: './my-dotfiles',
        defaultValue: './my-dotfiles',
      });

      if (p.isCancel(projectDir)) {
        p.outro('Cancelled.');
        process.exit(0);
      }

      const s = p.spinner();
      s.start('Initializing project...');
      await dottsInit(projectDir);
      s.stop('Project initialized successfully!');
      p.note(`Project created at ${projectDir}\nEdit ${join(projectDir, 'dotts.ts')} to get started.`, 'next steps');
    } else if (command === 'apply') {
      const configPath = await p.text({
        message: 'Path to dotts.ts?',
        placeholder: './dotts.ts',
        defaultValue: './dotts.ts',
      });

      if (p.isCancel(configPath)) {
        p.outro('Cancelled.');
        process.exit(0);
      }

      await dottsApply(configPath);
    }
  } catch (error) {
    p.log.error(color.red(error instanceof Error ? error.message : String(error)));
  }
  
  p.outro(color.green('Done!'));
}

main().catch(console.error);
