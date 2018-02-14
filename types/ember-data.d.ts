// This is necessary to avoid a type error during precompilation;
// it should have no bearing on host applications.
declare module 'ember-data' {
  interface ModelRegistry {
    [key: string]: any;
  }
}
