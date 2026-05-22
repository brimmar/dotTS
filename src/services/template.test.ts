import { describe, it, expect } from 'bun:test';
import { Effect, Layer } from 'effect';
import { TemplateService, TemplateServiceLive } from './template';

describe('TemplateService', () => {
  it('should render a mustache template', async () => {
    const program = Effect.gen(function* () {
      const svc = yield* TemplateService;
      return yield* svc.render('Hello {{name}}!', { name: 'World' });
    });

    const result = await Effect.runPromise(Effect.provide(program, TemplateServiceLive));
    expect(result).toBe('Hello World!');
  });
});
