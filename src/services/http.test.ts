import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { Effect, Layer } from 'effect';
import { HttpService, HttpServiceLive } from './http';

describe('HttpService', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should download a file as a string', async () => {
    const mockFetch = mock(() => Promise.resolve(new Response('hello world', { status: 200 })));
    global.fetch = mockFetch as any;

    const program = Effect.gen(function* () {
      const http = yield* HttpService;
      return yield* http.downloadString('https://example.com/test.txt');
    });

    const result = await Effect.runPromise(program.pipe(Effect.provide(HttpServiceLive)));

        expect(result).toBe('hello world');

        expect(mockFetch).toHaveBeenCalledWith('https://example.com/test.txt');

      });

    

      it('should handle 404 errors', async () => {

        global.fetch = mock(() => Promise.resolve(new Response('Not Found', { status: 404, statusText: 'Not Found' }))) as any;

    

        const program = Effect.gen(function* () {

          const http = yield* HttpService;

          return yield* http.downloadString('https://example.com/404.txt');

        });

    

        const result = await Effect.runPromiseExit(program.pipe(Effect.provide(HttpServiceLive)));

    

        expect(result._tag).toBe('Failure');

        if (result._tag === 'Failure') {

          expect(result.cause._tag).toBe('Fail');

          // @ts-ignore

          expect(result.cause.error.message).toContain('404 Not Found');

        }

      });

    });

    