import { describe, it, expect } from 'bun:test';
import { formatError, DottsError } from './errors';

describe('Error Formatter', () => {
  it('should format missing secret error', () => {
    const error = new Error('Secret not found: API_KEY');
    const formatted = formatError(error);
    expect(formatted.title).toBe('Missing Secret');
    expect(formatted.hint).toContain('dotts secrets set');
  });

  expect(formatError('some string').title).toBe('Unexpected Error');

  it('should format permission denied error', () => {
    const error = new Error('EACCES: permission denied, open "/etc/passwd"');
    const formatted = formatError(error);
    expect(formatted.title).toBe('Permission Denied');
  });

  it('should handle DottsError with custom hint', () => {
    const error = new DottsError('Custom error', 'Try this');
    const formatted = formatError(error);
    expect(formatted.message).toBe('Custom error');
    expect(formatted.hint).toBe('Try this');
  });
});
