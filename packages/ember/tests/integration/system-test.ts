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
  });
}
