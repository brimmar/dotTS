import { describe, expect, it } from 'bun:test';
import { DottsSchema } from './schema';

describe('DottsSchema', () => {
  it('should validate a correct configuration', () => {
    const config = {
      name: 'my-dotfiles',
      packages: [{ name: 'neovim', manager: 'brew' }],
      symlinks: [{ source: './zshrc', target: '~/.zshrc' }],
      files: [{ path: '~/.gitconfig', content: '[user]\n  name = Test' }],
    };
    const result = DottsSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it('should use default values for optional fields', () => {
    const config = { name: 'minimal' };
    const result = DottsSchema.safeParse(config);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.packages).toEqual([]);
      expect(result.data.symlinks).toEqual([]);
      expect(result.data.files).toEqual([]);
    }
  });

  it('should fail on invalid configuration', () => {
    const config = {
      name: 123, // Invalid type
    };
    const result = DottsSchema.safeParse(config);
    expect(result.success).toBe(false);
  });
});
