import Application from '@ember/application';
import Resolver from './resolver';
import loadInitializers from 'ember-load-initializers';
import config from './config/environment';

// @ts-ignore
Ember.run.backburner.DEBUG = true;

// Ensure the plugin code is included in API docs
import '@milestones/babel-plugin-strip-milestones';

const App = Application.extend({
  modulePrefix: config.modulePrefix,
  podModulePrefix: config.podModulePrefix,
  Resolver,
});

loadInitializers(App, config.modulePrefix);

export default App;
