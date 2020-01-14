import { module, test } from 'qunit';
import { schedule } from '@ember/runloop';
import { milestone, advanceTo, setupMilestones } from '@milestones/core';
import Env from 'dummy/config/environment';

if (!Env.STRIP_MILESTONES) {
  module('Integration | system hooks', function(hooks) {
    setupMilestones(hooks, ['one']);

    test('milestone continuation occurs in a runloop', async function(assert) {
      let program = async (): Promise<string> => {
        let value = 'before';
        await milestone('one', async () => schedule('actions', () => (value = 'after')));
        return value;
      };

      let programPromise = program();
      await advanceTo('one').andContinue();
      assert.equal(await programPromise, 'after');
    });

    test("throwing an error doesn't fail the test", async function(assert) {
      let program = async (): Promise<string> => {
        try {
          return await milestone('one', async () => 'bad');
        } catch (error) {
          return error.message;
        }
      };

      let programPromise = program();
      await advanceTo('one').andThrow(new Error('ok'));
      assert.equal(await programPromise, 'ok');
    });
  });
}
