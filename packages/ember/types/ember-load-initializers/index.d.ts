declare module 'ember-load-initializers' {
  import Engine from '@ember/engine';

  export default function loadInitializers(app: typeof Engine, modulePrefix: string): void;
}
