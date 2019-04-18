import { module, test } from 'qunit';
import { EvaluationThread, EvaluationFunction } from 'dummy/utils/evaluation/evaluation-thread';
import { deactivateAllMilestones } from '@milestones/core';
import Env from 'dummy/config/environment';

if (!Env.STRIP_MILESTONES) {
  module('Unit | Evaluation | EvaluationThread', function(hooks) {
    hooks.afterEach(() => deactivateAllMilestones());

    test('synchronous evaluation', async function(assert) {
      let location = 'unstarted';
      let fn: EvaluationFunction = async (line): Promise<string> => {
        location = '0';
        await line(1);
        location = '1';
        await line(2);
        location = '2';
        return 'done';
      };

      let evaluation = new EvaluationThread(fn);
      assert.equal(location, 'unstarted');
      assert.deepEqual(evaluation.getPausePoint(), { type: 'async', line: 1 });

      await evaluation.step();
      assert.equal(location, '0');
      assert.deepEqual(evaluation.getPausePoint(), { type: 'sync', line: 1 });

      await evaluation.step();
      assert.equal(location, '1');
      assert.deepEqual(evaluation.getPausePoint(), { type: 'sync', line: 2 });

      await evaluation.step();
      assert.equal(location, '2');
      assert.deepEqual(evaluation.getPausePoint(), undefined);
      assert.equal(await evaluation.completionValue(), 'done');
      assert.ok(evaluation.isComplete());
    });

    test('asynchronous pauses', async function(assert) {
      let location = 'unstarted';
      let fn: EvaluationFunction = async (line, async): Promise<string> => {
        location = '0';
        await line(1);
        location = '1';
        await async(1, Promise.resolve());
        location = '2';
        await line(2);
        location = '3';
        await async(2, new Promise(r => setTimeout(r, 50)));
        location = '4';
        return 'done';
      };

      let evaluation = new EvaluationThread(fn);
      assert.equal(location, 'unstarted');
      assert.deepEqual(evaluation.getPausePoint(), { type: 'async', line: 1 });

      await evaluation.step();
      assert.equal(location, '0');
      assert.deepEqual(evaluation.getPausePoint(), { type: 'sync', line: 1 });

      await evaluation.step();
      assert.equal(location, '1');
      assert.deepEqual(evaluation.getPausePoint(), { type: 'async', line: 1 });

      // Resolved promise steps immediately
      await evaluation.step();
      assert.equal(location, '2');
      assert.deepEqual(evaluation.getPausePoint(), { type: 'sync', line: 2 });

      await evaluation.step();
      assert.equal(location, '3');
      assert.deepEqual(evaluation.getPausePoint(), { type: 'async', line: 2 });

      // Unresolved promises shift back to a sync pause when they do resolve
      await evaluation.step();
      assert.equal(location, '3');
      assert.deepEqual(evaluation.getPausePoint(), { type: 'sync', line: 2 });

      await evaluation.step();
      assert.equal(location, '4');
      assert.deepEqual(evaluation.getPausePoint(), undefined);
      assert.equal(await evaluation.completionValue(), 'done');
      assert.ok(evaluation.isComplete());
    });
  });
}
