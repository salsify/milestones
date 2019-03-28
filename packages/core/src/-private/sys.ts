import { getOrInit } from './global';

/** @hide */
export interface Deferred<T> {
  promise: Promise<T>;
  cancel?(reason?: string): void;
  resolve(value?: T): void;
  reject(error?: unknown): void;
}

/** @hide */
export interface System {
  defer: <T>() => Deferred<T>;
  run: <T>(f: () => T) => T;
  assert: (value: boolean, message: string) => void;
}

/** @hide */
export function defer<T>(): Deferred<T> {
  return sys.defer();
}

/** @hide */
export function run<T>(callback: () => T): T {
  return sys.run(callback);
}

/** @hide */
export function assert(value: boolean, message: string): void {
  sys.assert(value, message);
}

/** @hide */
export function registerSystem(impl: Partial<System>): void {
  Object.assign(sys, impl);
}

/** @hide */
export function resetSystem(): void {
  Object.assign(sys, {
    run: defaultRun,
    defer: defaultDefer,
    assert: defaultAssert,
  });
}

function defaultDefer<T>(): Deferred<T> {
  let resolve!: (value?: T) => void;
  let reject!: (error?: unknown) => void;
  let promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { resolve, reject, promise };
}

function defaultAssert(value: boolean, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

function defaultRun<T>(f: () => T): T {
  return f();
}

const sys: System = getOrInit('sys', () => ({
  run: defaultRun,
  defer: defaultDefer,
  assert: defaultAssert,
}));
