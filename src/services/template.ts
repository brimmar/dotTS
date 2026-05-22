import { Context, Effect, Layer } from 'effect';
import Mustache from 'mustache';

export interface TemplateService {
  readonly render: (template: string, view: any) => Effect.Effect<string, Error>;
}

export const TemplateService = Context.GenericTag<TemplateService>('TemplateService');

export const TemplateServiceLive = Layer.succeed(
  TemplateService,
  TemplateService.of({
    render: (template, view) =>
      Effect.try({
        try: () => Mustache.render(template, view),
        catch: (error) => new Error(`Failed to render template: ${String(error)}`),
      }),
  })
);
