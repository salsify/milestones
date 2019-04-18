import AddonDocsRouter, { docsRoute } from 'ember-cli-addon-docs/router';
import config from './config/environment';

const Router = AddonDocsRouter.extend({
  location: config.locationType,
  rootURL: config.rootURL,
});

Router.map(function() {
  this.route('loop');

  docsRoute(this, function() {
    this.route('interacting-with-milestones');
    this.route('milestone-keys');
    this.route('coordination');
    this.route('deactivating-milestones');

    this.route('babel-plugin');
    this.route('ember');

    this.route('referencing-milestones');
    this.route('skipping-pauses');

    this.route('faq');
    this.route('the-playground');
    this.route('acknowledgements');
  });

  this.route('not-found', { path: '*path' });
});

export default Router;
