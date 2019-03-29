import { module, test } from 'qunit';
import { milestone, setupMilestones } from '@milestones/core';
import Env from 'dummy/config/environment';

if (Env.STRIP_MILESTONES) {
  module('Integration | babel plugin', function(hooks) {
    setupMilestones(hooks, ['one', 'two']);

    test('milestones are stripped from code', async function(assert) {
      let x = await milestone('one');
      let y = await milestone('two', async () => 5);

      assert.strictEqual(x, undefined);
      assert.strictEqual(y, 5);
    });
  });
}
