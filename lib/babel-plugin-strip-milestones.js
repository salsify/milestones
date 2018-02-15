'use strict';

module.exports = (ui) => {
  return Object.assign(stripMilestones, {
    baseDir: () => `${__dirname}/..`
  });

  function stripMilestones(babel) {
    const t = babel.types;

    return {
      visitor: {
        ImportDeclaration(path, pass) {
          if (path.node.source.value === 'ember-milestones') {
            let milestoneSpecifier = findMilestoneSpecifier(path, pass);
            if (!milestoneSpecifier) { return; }

            removeMilestoneCalls(milestoneSpecifier, path.scope, pass);

            // If `milestone` was the only import, remove the statement
            if (path.node.specifiers.length === 1) {
              path.remove();
            }
          }
        }
      }
    };

    function findMilestoneSpecifier(path, pass) {
      let warned = false;
      let milestoneSpecifier;
      for (let specifier of path.node.specifiers) {
        if (specifier.imported.name === 'milestone') {
          milestoneSpecifier = specifier;
        } else if (!warned) {
          issueWarning(path, pass, 'Unable to safely remove an import referencing more than just `milestone`.');
          warned = true;
        }
      }
      return milestoneSpecifier;
    }

    function issueWarning(path, pass, message) {
      try {
        // file.wrap gives the thrown error its `codeFrame` property
        pass.file.wrap(pass.file.code, () => {
          throw path.buildCodeFrameError(message);
        });
      } catch (error) {
        ui.writeWarnLine(`${error.message}\n${error.codeFrame}\n`); // eslint-disable-line no-console
      }
    }

    function removeMilestoneCalls(importSpecifier, scope, pass) {
      let localName = importSpecifier.local.name;
      let binding = scope.bindings[localName];

      for (let milestonePath of binding.referencePaths) {
        if (!t.isCallExpression(milestonePath.parent) || milestonePath.parentKey !== 'callee') {
          issueWarning(milestonePath, pass, 'Unable to safely strip invalid `milestone` usage.');
          continue;
        }

        let callPath = milestonePath.parentPath;
        let callback = callPath.node.arguments[1];

        if (callback) {
          callPath.replaceWith(t.callExpression(callback, []));
        } else {
          callPath.replaceWith(t.identifier('undefined'));
        }
      }
    }
  }
};
