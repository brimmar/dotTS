import { describe, expect, it } from 'bun:test';
import {
  APPLY_HELP,
  CHECK_HELP,
  DOCTOR_HELP,
  GLOBAL_HELP,
  INIT_HELP,
  PREPARE_HELP,
  SECRETS_GET_HELP,
  SECRETS_HELP,
  SECRETS_LIST_HELP,
  SECRETS_REMOVE_HELP,
  SECRETS_SET_HELP,
  getHelpText,
} from './help';

describe('getHelpText', () => {
  it('returns global help when no command is provided', () => {
    expect(getHelpText()).toBe(GLOBAL_HELP);
    expect(getHelpText(undefined)).toBe(GLOBAL_HELP);
  });

  it('returns command-specific help', () => {
    expect(getHelpText('init')).toBe(INIT_HELP);
    expect(getHelpText('prepare')).toBe(PREPARE_HELP);
    expect(getHelpText('check')).toBe(CHECK_HELP);
    expect(getHelpText('apply')).toBe(APPLY_HELP);
    expect(getHelpText('doctor')).toBe(DOCTOR_HELP);
    expect(getHelpText('secrets')).toBe(SECRETS_HELP);
  });

  it('returns subcommand-specific help for secrets', () => {
    expect(getHelpText('secrets', 'get')).toBe(SECRETS_GET_HELP);
    expect(getHelpText('secrets', 'set')).toBe(SECRETS_SET_HELP);
    expect(getHelpText('secrets', 'list')).toBe(SECRETS_LIST_HELP);
    expect(getHelpText('secrets', 'remove')).toBe(SECRETS_REMOVE_HELP);
  });

  it('falls back to global help for unknown command', () => {
    expect(getHelpText('unknown')).toBe(GLOBAL_HELP);
  });
});
