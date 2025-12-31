import * as p from '@clack/prompts';
import { color } from 'console-log-colors';
import { dottsInit } from './commands/init';
import { dottsApply } from './commands/apply';
import { dottsCheck } from './commands/check';
import { dottsDoctor } from './commands/doctor';
import { dottsSecretSet, dottsSecretList } from './commands/secrets';
import { join } from 'node:path';

async function main() {
  p.intro(color.cyan(' dotts '));

  const command = await p.select({
    message: 'What would you like to do?',
    options: [
      { value: 'init', label: 'Initialize a new project', hint: 'dotts init' },
      { value: 'check', label: 'Check configuration', hint: 'dotts check' },
      { value: 'doctor', label: 'System Diagnostics', hint: 'dotts doctor' },
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
    } else if (command === 'check') {
      const configPath = await p.text({
        message: 'Path to dotts.ts?',
        placeholder: './dotts.ts',
        defaultValue: './dotts.ts',
      });

      if (p.isCancel(configPath)) {
        p.outro('Cancelled.');
        process.exit(0);
      }

      await dottsCheck(configPath);
    } else if (command === 'doctor') {
      await dottsDoctor();
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

      const dryRun = await p.confirm({
        message: 'Do you want to run in Dry Run mode? (No changes will be made)',
        initialValue: true,
      });

      if (p.isCancel(dryRun)) {
        p.outro('Cancelled.');
        process.exit(0);
      }

      await dottsApply(configPath, { dryRun: dryRun as boolean });
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
