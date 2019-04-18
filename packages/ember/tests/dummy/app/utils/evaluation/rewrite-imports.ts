import { transformSync, PluginObj, types as t } from '@babel/core';
import { ImportDeclaration, LVal, ObjectProperty } from '@babel/types';

const REQUIRE_IDENTIFIER = '__import__';

export function rewriteImports(code: string): string {
  let wrapped = `(${REQUIRE_IDENTIFIER})=>{\n${code}\n}`;
  let plugins = [rewriteImportsPlugin];
  let parserOpts = { allowImportExportEverywhere: true };
  let generatorOpts = { retainLines: true };
  let result = transformSync(wrapped, { plugins, parserOpts, generatorOpts });

  if (!result || !result.code) {
    throw new Error('Invalid code');
  }

  // Strip trailing semicolon
  return result.code.slice(0, -1);
}

function rewriteImportsPlugin(): PluginObj {
  return {
    visitor: {
      ImportDeclaration(path) {
        let lhs = getNamespaceImport(path.node) || getImportBindingPattern(path.node);
        let rhs = t.callExpression(t.identifier(REQUIRE_IDENTIFIER), [path.node.source]);
        path.replaceWith(t.variableDeclaration('const', [t.variableDeclarator(lhs, rhs)]));
      },
    },
  };
}

function getNamespaceImport(declaration: ImportDeclaration): LVal | void {
  if (declaration.specifiers.length === 1 && declaration.specifiers[0].type === 'ImportNamespaceSpecifier') {
    return declaration.specifiers[0].local;
  }
}

function getImportBindingPattern(declaration: ImportDeclaration): LVal {
  let properties: ObjectProperty[] = [];
  for (let specifier of declaration.specifiers) {
    if (specifier.type === 'ImportDefaultSpecifier') {
      properties.push(t.objectProperty(t.identifier('default'), specifier.local));
    } else if (specifier.type === 'ImportSpecifier') {
      properties.push(
        t.objectProperty(specifier.imported, specifier.local, false, specifier.imported.name === specifier.local.name),
      );
    } else {
      throw new Error('Unknown import specifier type');
    }
  }
  return t.objectPattern(properties);
}
