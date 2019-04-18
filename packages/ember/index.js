'use strict';

// eslint-disable-next-line node/no-unpublished-require
const EmberApp = require('ember-cli/lib/broccoli/ember-app');
const { hasPlugin, addPlugin } = require('ember-cli-babel-plugin-helpers');

module.exports = {
  name: require('./package').name,

  included() {
    this._super.included.apply(this, arguments);

    // For potentially installing the Babel plugin to strip milestones, we want to
    // apply to our direct parent, whether it's an addon or the root app.
    let parent = this.app || this.addon;
    if (this._shouldStripMilestones() && !hasPlugin(parent, '@milestones/babel-plugin-strip-milestones')) {
      addPlugin(parent, require.resolve('@milestones/babel-plugin-strip-milestones'));
    }
  },

  // The host app should always get the final say in whether milestones should
  // be stripped, even if we're included as a transitive dependency of some addon.
  _milestonesOptions() {
    let options = findHost(this).options || {};
    return options.milestones || {};
  },

  _shouldStripMilestones() {
    let options = this._milestonesOptions();
    if ('stripMilestones' in options) {
      return options.stripMilestones;
    } else {
      return EmberApp.env() !== 'production';
    }
  },
};

function findHost(addon) {
  var current = addon;
  var app;

  do {
    app = current.app || app;
  } while (current.parent.parent && (current = current.parent));

  return app;
}
