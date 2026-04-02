import { createWithEqualityFn } from 'zustand/traditional';
import type { StateCreator } from 'zustand/vanilla';
import { shallow } from 'zustand/vanilla/shallow';

export const createStore: typeof createWithEqualityFn = ((initializer?: unknown) =>
    initializer
        ? createWithEqualityFn(initializer as StateCreator<unknown, [], []>, shallow)
        : <T, Mos extends [never, unknown][] = []>(nextInitializer: StateCreator<T, [], Mos>) =>
              createWithEqualityFn<T, Mos>(
                  nextInitializer,
                  shallow,
              )) as typeof createWithEqualityFn;
