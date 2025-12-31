import * as p from '@clack/prompts';
import { color } from 'console-log-colors';
import { dottsInit } from './commands/init';
import { dottsApply } from './commands/apply';
import { dottsSecretSet, dottsSecretList } from './commands/secrets';
import { join } from 'node:path';

async function main() {
  p.intro(color.cyan(' dotts '));

  const command = await p.select({
    message: 'What would you like to do?',
    options: [
      { value: 'init', label: 'Initialize a new project', hint: 'dotts init' },
      { value: 'apply', label: 'Apply configuration', hint: 'dotts apply' },
      { value: 'secrets', label: 'Manage secrets', hint: 'dotts secrets' },
      { value: 'exit', label: 'Exit' },
    ],
  });

  if (p.isCancel(command) || command === 'exit') {
    p.outro('Goodbye!');
    process.exit(0);
  }

  try {
    if (command === 'init') {
      // ... (keep init logic)
    } else if (command === 'apply') {
      // ... (keep apply logic)
    } else if (command === 'secrets') {
      const secretAction = await p.select({
        message: 'Secret management:',
        options: [
          { value: 'set', label: 'Set a secret' },
          { value: 'list', label: 'List secrets' },
        ]
      });

      if (p.isCancel(secretAction)) {
        p.outro('Cancelled.');
        process.exit(0);
      }

      if (secretAction === 'set') {
        const name = await p.text({ message: 'Secret name (e.g. GITHUB_TOKEN):' });
        if (p.isCancel(name) || !name) return;
        
        const value = await p.password({ message: 'Secret value:' });
        if (p.isCancel(value) || !value) return;

        await dottsSecretSet(name, value);
      } else if (secretAction === 'list') {
        await dottsSecretList();
      }
    }
  } catch (error) {
    p.log.error(color.red(error instanceof Error ? error.message : String(error)));
  }
  
  p.outro(color.green('Done!'));
}

main().catch(console.error);
