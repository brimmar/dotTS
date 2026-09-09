import * as p from '@clack/prompts';
import { join } from 'node:path';
import pc from 'picocolors';
import { HELP_TEXT, parseArgv } from './cli-parse';
import { dottsApply } from './commands/apply';
import { dottsCheck } from './commands/check';
import { dottsDoctor } from './commands/doctor';
import { dottsInit } from './commands/init';
import { dottsPrepare } from './commands/prepare';
import { dottsSecretList, dottsSecretRemove, dottsSecretSet } from './commands/secrets';
import { formatError } from './core/errors';

async function main() {
  const args = process.argv.slice(2);

  if (args.length > 0) {
    try {
      const request = parseArgv(args);

      if (request.kind === 'help') {
        // --help / -h prints usage and does not open the interactive menu
        process.stdout.write(`${HELP_TEXT}\n`);
        return;
      }

      if (request.kind === 'init') {
        p.log.step(`Initializing project at ${request.projectDir}...`);
        await dottsInit(request.projectDir);
        p.log.success('Project initialized successfully!');
        p.note(`Project created at ${request.projectDir}\nEdit ${join(request.projectDir, 'dotts.ts')} to get started.`, 'next steps');
      } else if (request.kind === 'prepare') {
        p.log.step(`Preparing editor types at ${request.dir}...`);
        await dottsPrepare(request.dir);
        p.log.success('Editor types prepared.');
      } else if (request.kind === 'check') {
        await dottsCheck(request.configPath);
      } else if (request.kind === 'doctor') {
        await dottsDoctor();
      } else if (request.kind === 'apply') {
        await dottsApply(request.configPath, { dryRun: request.dryRun });
      } else if (request.kind === 'secrets-set') {
        await dottsSecretSet(request.name, request.value);
      } else if (request.kind === 'secrets-list') {
        await dottsSecretList();
      } else if (request.kind === 'secrets-remove') {
        await dottsSecretRemove(request.name);
      }
    } catch (error) {
      const formatted = formatError(error);
      p.log.error(pc.red(`${formatted.title}: ${formatted.message}`));
      if (formatted.hint) {
        p.note(formatted.hint, 'suggested fix');
      }
      process.exit(1);
    }
    return;
  }

  p.intro(pc.cyan(' dotts '));

  const command = await p.select({
    message: 'What would you like to do?',
    options: [
      { value: 'init', label: 'Initialize a new project', hint: 'dotts init' },
      { value: 'prepare', label: 'Prepare editor types', hint: 'dotts prepare' },
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
    } else if (command === 'prepare') {
      await dottsPrepare();
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
          { value: 'remove', label: 'Remove a secret' },
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
      } else if (secretAction === 'remove') {
        const name = await p.text({ message: 'Secret name to remove:' });
        if (p.isCancel(name) || !name) return;
        await dottsSecretRemove(name);
      }
    }
  } catch (error) {
    const formatted = formatError(error);
    p.log.error(pc.red(`${formatted.title}: ${formatted.message}`));
    if (formatted.hint) {
      p.note(formatted.hint, 'suggested fix');
    }
  }
  
  p.outro(pc.green('Done!'));
}

main().catch(console.error);