import { describe, beforeEach, afterEach, test } from 'mocha';
import { expect } from 'chai';
import { stripIndent } from 'common-tags';
import sinon, { SinonStub } from 'sinon';
import * as Babel6 from 'babel-core';
import * as Babel7 from '@babel/core';
import plugin from '../src/index';

describe('@milestones/babel-plugin', () => {
  let warnStub: SinonStub<[unknown?, ...unknown[]]>;
  beforeEach(() => {
    warnStub = sinon.stub(console, 'warn');
  });

  afterEach(() => {
    warnStub.restore();
  });

  describe('Babel 6', () => {
    testPlugin(Babel6);
  });

  describe('Babel 7', () => {
    testPlugin(Babel7);
  });

  function testPlugin(babel: typeof Babel6 | typeof Babel7): void {
    function transform(input: string): Babel6.BabelFileResult | Babel7.BabelFileResult {
      return babel.transform(input, {
        filename: '/input.js',
        highlightCode: false,
        plugins: [plugin],
      })!;
    }

    test('stripping milestones with callbacks', () => {
      let source = stripIndent`
        import { milestone } from '@milestones/core';

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

      expect(transform(source).code!.trim()).to.equal(expected.trim());
      expect(warnStub.notCalled).to.be.ok;
    });

    test('stripping milestones without callbacks', () => {
      let source = stripIndent`
        import { milestone } from '@milestones/core';

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

      expect(transform(source).code!.trim()).to.equal(expected.trim());
      expect(warnStub.notCalled).to.be.ok;
    });

    test('warning about unremovable milestones', () => {
      let source = stripIndent`
        import { milestone } from '@milestones/core';

        async function foo() {
          console.log(milestone);
        }
      `;

      let expected = stripIndent`
        async function foo() {
          console.log(milestone);
        }
      `;

      expect(transform(source).code!.trim()).to.equal(expected.trim());
      expect((warnStub.lastCall.args[0] as string).trim()).to.equal(stripIndent`
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
