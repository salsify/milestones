'use strict';

// eslint-disable-next-line node/no-unpublished-require
const EmberAddon = require('ember-cli/lib/broccoli/ember-addon');

module.exports = function(defaults) {
  let app = new EmberAddon(defaults, {
    milestones: {
      stripMilestones: `${process.env.STRIP_MILESTONES}` === 'true',
    },

    autoImport: {
      webpack: {
        node: {
          fs: 'empty',
        },
      },
    },

    cssModules: {
      plugins: {
        before: [require('postcss-nested')], // eslint-disable-line node/no-unpublished-require
      },
    },

    'ember-cli-babel': {
      throwUnlessParallelizable: true,
    },

    'ember-cli-addon-docs-typedoc': {
      packages: ['@milestones/core', '@milestones/ember', '@milestones/babel-plugin-strip-milestones'],
    },
  });

  /*
    This build file specifies the options for the dummy test app of this
    addon, located in `/tests/dummy`
    This build file does *not* influence how the addon or the app using it
    behave. You most likely want to be modifying `./index.js` or app's build file
  */

  return app.toTree();
};
