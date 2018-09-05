'use strict';

const QUnit = require('qunit'), test = QUnit.test;
const stripIndent = require('common-tags').stripIndent;
const sinon = require('sinon');
const plugin = require('../../lib/babel-plugin-strip-milestones');

QUnit.module('Unit | babel-plugin-strip-milestones', (hooks) => {
  let ui = {};
  hooks.beforeEach(() => {
    ui.writeWarnLine = sinon.spy();
  });

  QUnit.module('Babel 6', function() {
    testPlugin(require('babel-core'));
  });

  QUnit.module('Babel 7', function() {
    testPlugin(require('@babel/core'));
  });

  function testPlugin(babel) {
    function transform(input) {
      return babel.transform(input, {
        filename: '/input.js',
        highlightCode: false,
        plugins: [plugin(ui)]
      });
    }

    test('stripping milestones with callbacks', (assert) => {
      let source = stripIndent`
        import { milestone } from 'ember-milestones';

        async function foo() {
          let result = await milestone('bar', () => 'hello');
          console.log(result);
        }
      `;

      let expected = stripIndent`
        async function foo() {
          let result = await (() => 'hello')();
          console.log(result);
        }
      `;

      assert.equal(transform(source).code.trim(), expected.trim());
      assert.ok(ui.writeWarnLine.notCalled);
    });

    test('stripping milestones without callbacks', (assert) => {
      let source = stripIndent`
        import { milestone } from 'ember-milestones';

        async function foo() {
          let result = await milestone('bar');
          console.log(result);
        }
      `;

      let expected = stripIndent`
        async function foo() {
          let result = await undefined;
          console.log(result);
        }
      `;

      assert.equal(transform(source).code.trim(), expected.trim());
      assert.ok(ui.writeWarnLine.notCalled);
    });

    test('warning about unremovable imports', (assert) => {
      let source = stripIndent`
        import { milestone, advanceTo } from 'ember-milestones';

        async function foo() {
          let result = await milestone('bar');
          console.log(result);
        }

        advanceTo('bar');
      `;

      let expected = stripIndent`
        import { milestone, advanceTo } from 'ember-milestones';

        async function foo() {
          let result = await undefined;
          console.log(result);
        }

        advanceTo('bar');
      `;

      assert.equal(transform(source).code.trim(), expected.trim());
      assert.equal(ui.writeWarnLine.lastCall.args[0].trim(), stripIndent`
        /input.js: Unable to safely remove an import referencing more than just \`milestone\`.
        > 1 | import { milestone, advanceTo } from 'ember-milestones';
            | ^
          2 |\x20
          3 | async function foo() {
          4 |   let result = await milestone('bar');
      `);
    });

    test('warning about unremovable milestones', (assert) => {
      let source = stripIndent`
        import { milestone } from 'ember-milestones';

        async function foo() {
          console.log(milestone);
        }
      `;

      let expected = stripIndent`
        async function foo() {
          console.log(milestone);
        }
      `;

      assert.equal(transform(source).code.trim(), expected.trim());
      assert.equal(ui.writeWarnLine.lastCall.args[0].trim(), stripIndent`
        /input.js: Unable to safely strip invalid \`milestone\` usage.
          2 |\x20
          3 | async function foo() {
        > 4 |   console.log(milestone);
            |               ^
          5 | }
      `);
    });
  }
});
