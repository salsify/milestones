'use strict';

 // eslint-disable-next-line node/no-unpublished-require
const EmberApp = require('ember-cli/lib/broccoli/ember-app');

module.exports = {
  name: 'ember-milestones',

  included() {
    this._super.included.apply(this, arguments);
    if (this._shouldStripMilestones()) {
      let parentOptions = this._parentOptions();
      parentOptions.babel = parentOptions.babel || {};
      parentOptions.babel.plugins = parentOptions.babel.plugins || [];
      parentOptions.babel.plugins.push(require('./lib/babel-plugin-strip-milestones')(this.ui));
    }
  },

  treeForAddon() {
    if (this._isEnabled()) {
      return this._super.treeForAddon.apply(this, arguments);
    }
  },

  // For potentially installing the Babel plugin to strip milestones, we want to
  // apply to our direct parent, whether it's an addon or the root app.
  _parentOptions() {
    return (this.app ? this.app.options : this.parent.options) || {};
  },

  // The host app should always get the final say in whether milestones should
  // be stripped, even if we're included as a transitive dependency of some addon.
  _milestonesOptions() {
    let options = findHost(this).options || {};
    return options.milestones || {};
  },

  _isEnabled() {
    let options = this._milestonesOptions();
    if ('enabled' in options) {
      return options.enabled;
    } else {
      return EmberApp.env() !== 'production';
    }
  },

  _shouldStripMilestones() {
    let options = this._milestonesOptions();
    if ('stripMilestones' in options) {
      return options.stripMilestones;
    } else {
      return !this._isEnabled();
    }
  }
};

function findHost(addon) {
  var current = addon;
  var app;

  do {
    app = current.app || app;
  } while (current.parent.parent && (current = current.parent));

  return app;
}
