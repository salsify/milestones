import { module, test } from 'qunit';
import { stripIndent } from 'common-tags';
import { deactivateAllMilestones } from '@milestones/core';
import { Evaluation, PausePoint } from 'dummy/utils/evaluation';
import Env from 'dummy/config/environment';

if (!Env.STRIP_MILESTONES) {
  module('Unit | Evaluation', function(hooks) {
    hooks.afterEach(() => deactivateAllMilestones());

    test('simple evaluation', async function(assert) {
      let global = { x: 0 };

      let evaluation = new Evaluation(
        `import { global } from 'import-path';`,
        {
          source: stripIndent`
            global.x = 1;
            global.x = 2;
            global.x = 3;
          `,
        },
        path => {
          assert.equal(path, 'import-path');
          return { global };
        },
      );

      let pausePoints: Record<string, PausePoint[]> = {};
      evaluation.onStateChange(pauses => (pausePoints = pauses));

      await evaluation.step();
      assert.deepEqual(pausePoints, { source: [{ type: 'sync', line: 1 }] });
      assert.equal(global.x, 0);

      await evaluation.step();
      assert.deepEqual(pausePoints, { source: [{ type: 'sync', line: 2 }] });
      assert.equal(global.x, 1);

      await evaluation.step();
      assert.deepEqual(pausePoints, { source: [{ type: 'sync', line: 3 }] });
      assert.equal(global.x, 2);

      await evaluation.step();
      assert.deepEqual(pausePoints, { source: [] });
      assert.equal(global.x, 3);
      assert.ok(evaluation.isComplete());
    });

    test('nested evaluation', async function(assert) {
      let global = { x: 0 };

      let evaluation = new Evaluation(
        `import { global } from 'import-path';`,
        {
          source: stripIndent`
            global.x = 1;
            await Promise.all([
              async () => {
                global.x = 2;
                await null;
                global.x = 4;
              },
              async () => {
                global.x = 3;
                await null;
                global.x = 5;
              }
            ].map(f => f()));
            global.x = 6;
          `,
        },
        path => {
          assert.equal(path, 'import-path');
          return { global };
        },
      );

      let pausePoints: Record<string, PausePoint[]> = {};
      evaluation.onStateChange(pauses => (pausePoints = pauses));

      await evaluation.step();
      assert.deepEqual(pausePoints, { source: [{ type: 'sync', line: 1 }] });
      assert.equal(global.x, 0);

      await evaluation.step();
      assert.deepEqual(pausePoints, { source: [{ type: 'sync', line: 2 }] });
      assert.equal(global.x, 1);

      await evaluation.step();
      assert.deepEqual(pausePoints, {
        source: [{ type: 'async', line: 2 }, { type: 'sync', line: 4 }, { type: 'async', line: 9 }],
      });
      assert.equal(global.x, 1);

      await evaluation.step();
      assert.deepEqual(pausePoints, {
        source: [{ type: 'async', line: 2 }, { type: 'sync', line: 5 }, { type: 'async', line: 9 }],
      });
      assert.equal(global.x, 2);

      await evaluation.step();
      assert.deepEqual(pausePoints, {
        source: [{ type: 'async', line: 2 }, { type: 'async', line: 5 }, { type: 'sync', line: 9 }],
      });
      assert.equal(global.x, 2);

      await evaluation.step();
      assert.deepEqual(pausePoints, {
        source: [{ type: 'async', line: 2 }, { type: 'async', line: 5 }, { type: 'sync', line: 10 }],
      });
      assert.equal(global.x, 3);

      await evaluation.step();
      assert.deepEqual(pausePoints, {
        source: [{ type: 'async', line: 2 }, { type: 'sync', line: 6 }, { type: 'async', line: 10 }],
      });
      assert.equal(global.x, 3);

      await evaluation.step();
      assert.deepEqual(pausePoints, {
        source: [{ type: 'async', line: 2 }, { type: 'sync', line: 11 }],
      });
      assert.equal(global.x, 4);

      await evaluation.step();
      assert.deepEqual(pausePoints, {
        source: [{ type: 'sync', line: 2 }],
      });
      assert.equal(global.x, 5);

      await evaluation.step();
      assert.deepEqual(pausePoints, {
        source: [{ type: 'sync', line: 14 }],
      });
      assert.equal(global.x, 5);

      await evaluation.step();
      assert.deepEqual(pausePoints, { source: [] });
      assert.equal(global.x, 6);
      assert.ok(evaluation.isComplete());
    });
  });
}
