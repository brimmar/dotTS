import * as p from '@clack/prompts';
import { color } from 'console-log-colors';

async function main() {
  p.intro(color.cyan(' dotts '));

  p.note('Welcome to dotts - a modern, type-safe dotfile management tool.', 'info');

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

  p.log.info(`You selected: ${command}`);
  
  p.outro(color.green('Done!'));
}

main().catch(console.error);
