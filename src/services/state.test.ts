import { describe, it, expect } from 'bun:test';
import { Effect, Layer } from 'effect';
import { StateService, StateServiceLive } from './state';
import { FileSystemLive } from './fs';
import { SystemCommandLive } from './exec';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rm } from 'node:fs/promises';

describe('StateService', () => {
  const testDir = join(tmpdir(), 'dotts-state-test-' + Math.random().toString(36).slice(2));
  const stateFile = join(testDir, '.dotts/state.json');

  it('should save and load state', async () => {
    const program = Effect.gen(function* (_) {
      const state = yield* _(StateService);
      
      yield* _(state.setPath(stateFile));
      
      const initialState = yield* _(state.load());
      expect(initialState).toEqual({});
      
      yield* _(state.save({ 'res-1': { hash: 'abc', metadata: {} } }));
      
      const loadedState = yield* _(state.load());
      expect(loadedState).toEqual({ 'res-1': { hash: 'abc', metadata: {} } });
    });

    const runnable = program.pipe(
      Effect.provide(StateServiceLive),
      Effect.provide(FileSystemLive),
      Effect.provide(SystemCommandLive)
    );

    await Effect.runPromise(runnable);
    await rm(testDir, { recursive: true, force: true });
  });
});
