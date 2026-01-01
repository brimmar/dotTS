import { Context, Effect, Layer } from 'effect';

export interface HttpService {
  readonly downloadString: (url: string) => Effect.Effect<string, Error>;
  readonly downloadBytes: (url: string) => Effect.Effect<Uint8Array, Error>;
}

export const HttpService = Context.GenericTag<HttpService>('HttpService');

export const HttpServiceLive = Layer.succeed(
  HttpService,
  HttpService.of({
    downloadString: (url) =>
      Effect.tryPromise({
        try: async () => {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
          }
          return response.text();
        },
        catch: (error) => new Error(`HTTP Error: ${String(error)}`),
      }),
    downloadBytes: (url) =>
      Effect.tryPromise({
        try: async () => {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
          }
          const buffer = await response.arrayBuffer();
          return new Uint8Array(buffer);
        },
        catch: (error) => new Error(`HTTP Error: ${String(error)}`),
      }),
  })
);