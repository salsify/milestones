import { NodePath, Scope } from '@babel/traverse';
import { ImportDeclaration, ImportSpecifier, CallExpression, Expression } from '@babel/types';
import { PluginObj } from '@babel/core';

const SOURCE_MODULE = '@milestones/core';
const SOURCE_IDENTIFIER = 'milestone';

/**
 * A Babel plugin that strips all imports and usage of `milestone(key, callback)` and replaces
 * them with an equivalent invocation of `callback()`.
 */
export default function stripMilestones(babel: typeof import('@babel/core')): PluginObj<State> {
  const t = babel.types;

  return {
    visitor: {
      ImportDeclaration(path, state) {
        if (path.node.source.value === SOURCE_MODULE) {
          let milestoneSpecifiers = findMilestoneSpecifiers(path);

          for (let milestoneSpecifier of milestoneSpecifiers) {
            removeMilestoneCalls(milestoneSpecifier, path.scope, state);
          }

          // If `milestone` was the only import, remove the statement
          if (path.node.specifiers.length === milestoneSpecifiers.length) {
            path.remove();
          }
        }
      },
    },
  };

  function findMilestoneSpecifiers(path: NodePath<ImportDeclaration>): ImportSpecifier[] {
    let milestoneSpecifiers: ImportSpecifier[] = [];
    for (let specifier of path.node.specifiers) {
      if (specifier.type === 'ImportSpecifier' && specifier.imported.name === SOURCE_IDENTIFIER) {
        milestoneSpecifiers.push(specifier);
      }
    }
    return milestoneSpecifiers;
  }

  function issueWarning(path: NodePath<unknown>, state: State, message: string): void {
    let errorWithCodeFrame;
    if (typeof state.file.wrap === 'function') {
      // In Babel 6, file.wrap gives the thrown error its `codeFrame` property
      try {
        state.file.wrap(state.file.code, () => {
          throw path.buildCodeFrameError(message);
        });
      } catch (error) {
        errorWithCodeFrame = `${error.message}\n${error.codeFrame}\n`;
      }
    } else {
      // In Babel 7, we can just build the error directly
      errorWithCodeFrame = path.buildCodeFrameError(message).message;
    }

    console.warn(errorWithCodeFrame);
  }

  function removeMilestoneCalls(importSpecifier: ImportSpecifier, scope: Scope, state: State): void {
    let localName = importSpecifier.local.name;
    let binding = scope.bindings[localName];

    for (let milestonePath of binding.referencePaths) {
      if (!t.isCallExpression(milestonePath.parent) || milestonePath.parentKey !== 'callee') {
        issueWarning(milestonePath, state, 'Unable to safely strip invalid `milestone` usage.');
        continue;
      }

      let callPath = milestonePath.parentPath as NodePath<CallExpression>;
      let callback = callPath.node.arguments[1] as Expression;

      if (callback) {
        callPath.replaceWith(t.callExpression(callback, []));
      } else {
        callPath.replaceWith(t.identifier('undefined'));
      }
    }
  }
}

// Unclear where (if anywhere) this type info actually lives
interface State {
  file: {
    code: string;
    wrap?: (code: string, f: () => unknown) => void;
  };
}
