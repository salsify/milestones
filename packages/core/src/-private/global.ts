// Ensure if multiple instances of @milestones/core are floating around that they share state when possible.
// If the shape of that state changes in the future, we can bump the version here to at least emit a warning
// that things may break.
export function getOrInit<T>(key: string, init: () => T): T {
  if (!(key in state.storage)) {
    state.storage[key] = init();
  }
  return state.storage[key] as T;
}

export function clear(): void {
  state.storage = Object.create(null);
}

const STATE_VERSION = 1;
const STATE_KEY = '__milestones_state__';

interface MilestonesState {
  version: number;
  storage: Record<string, unknown>;
}

declare const global: Record<string, unknown> | undefined;

const globalThis: { [STATE_KEY]?: MilestonesState } =
  typeof self !== 'undefined'
    ? self
    : typeof window !== 'undefined'
    ? window
    : typeof global !== 'undefined'
    ? global
    : Function('return this')();

if (globalThis[STATE_KEY]) {
  if (globalThis[STATE_KEY]!.version !== STATE_VERSION) {
    console.warn(
      'Warning: multiple incompatible versions of @milestones/core are active.' +
        ' This may lead to unexpected behavior or breakage.',
    );
  }
} else {
  Object.defineProperty(globalThis, STATE_KEY, {
    value: {
      version: STATE_VERSION,
      storage: Object.create(null),
    },
  });
}

const state = globalThis[STATE_KEY]!;
