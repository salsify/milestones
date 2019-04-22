import { transformSync, PluginObj, types as t } from '@babel/core';
import { NodePath, Node } from '@babel/traverse';
import { ExpressionStatement, Function, Expression, BlockStatement } from '@babel/types';

const LINE_MARKER = '__line__';
const ASYNC_MARKER = '__async__';
const SPAWN_MARKER = '__spawn__';

export function annotateAsyncCode(code: string): string {
  let wrapped = `async (${LINE_MARKER}, ${ASYNC_MARKER}, ${SPAWN_MARKER}) => {${code}}`;
  let plugins = [lineMarkersPlugin];
  let result = transformSync(wrapped, { plugins });

  if (!result || !result.code) {
    throw new Error('Invalid code');
  }

  // Strip trailing semicolon
  return result.code.slice(0, -1);
}

function enclosingFunction(path: NodePath): NodePath<Function> | undefined {
  return path.findParent(p => t.isFunction(p.node)) as NodePath<Function>;
}

function isLineMarker(node: Node): boolean {
  return node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === LINE_MARKER;
}

function makeLineMarker(line: number): ExpressionStatement {
  return t.expressionStatement(
    t.awaitExpression(t.callExpression(t.identifier(LINE_MARKER), [t.numericLiteral(line)])),
  );
}

function makeAsyncMarker(expr: Expression): Expression {
  return t.callExpression(t.identifier(ASYNC_MARKER), [t.numericLiteral(getLineNumber(expr)), expr]);
}

function getLineNumber(node: Node): number {
  let nodes = node.type === 'BlockStatement' ? node.body : [node];
  for (let node of nodes) {
    let loc = node.loc;
    if (loc) {
      return loc.start.line;
    }
  }
  return -1;
}

function makeSpawnExpression(body: Expression | BlockStatement): Expression {
  return t.callExpression(t.identifier(SPAWN_MARKER), [
    t.numericLiteral(getLineNumber(body)),
    t.arrowFunctionExpression(
      [t.identifier(LINE_MARKER), t.identifier(ASYNC_MARKER), t.identifier(SPAWN_MARKER)],
      body,
      true,
    ),
  ]);
}

function isDeclaration(node: Node): boolean {
  return node.type === 'ClassDeclaration' || node.type === 'FunctionDeclaration';
}

function lineMarkersPlugin(): PluginObj {
  let lines: Set<number>;
  return {
    visitor: {
      Program() {
        lines = new Set();
      },
      BlockStatement: {
        exit(path) {
          let fn = enclosingFunction(path);
          if (!fn || !fn.node.async) return;

          for (let child of path.get('body')) {
            let line = getLineNumber(child.node);
            if (!lines.has(line) && !isDeclaration(child.node)) {
              lines.add(line);
              child.insertBefore(makeLineMarker(line));
            }
          }
        },
      },
      AwaitExpression(path) {
        if (!isLineMarker(path.node.argument)) {
          path.set('argument', makeAsyncMarker(path.node.argument));
        }
      },
      Function: {
        exit(path) {
          if (path.node.async && path.getAncestry().length > 3) {
            let body = path.get('body');
            let spawn = makeSpawnExpression(body.node);
            if (body.node.type === 'BlockStatement') {
              body.replaceWith(t.blockStatement([t.returnStatement(spawn)]));
            } else {
              body.replaceWith(spawn);
            }
          }
        },
      },
    },
  };
}
