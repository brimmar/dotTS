import { Context, Effect, Layer } from 'effect';

export interface HttpService {
  readonly downloadString: (url: string) => Effect.Effect<string, Error>;
  readonly downloadBytes: (url: string) => Effect.Effect<Uint8Array, Error>;
  readonly downloadWithMetadata: (url: string, etag?: string) => Effect.Effect<{ content: string; etag?: string; unchanged: boolean }, Error>;
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
    downloadWithMetadata: (url, etag) =>
      Effect.tryPromise({
        try: async () => {
          const headers: Record<string, string> = {};
          if (etag) {
            headers['If-None-Match'] = etag;
          }

          const response = await fetch(url, { headers });
          
          if (response.status === 304) {
            return { content: '', etag, unchanged: true };
          }

          if (!response.ok) {
            throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
          }

          const newEtag = response.headers.get('ETag') || undefined;
          const content = await response.text();
          
          return { content, etag: newEtag, unchanged: false };
        },
        catch: (error) => new Error(`HTTP Error: ${String(error)}`),
      }),
  })
);
