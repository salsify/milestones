import { visit } from '@ember/test-helpers';
import { advanceTo, setupMilestones } from '@milestones/core';
import { setupApplicationTest } from 'ember-qunit';
import { module, test } from 'qunit';
import Env from 'dummy/config/environment';
import { TickTimer } from 'dummy/routes/loop';

if (!Env.STRIP_MILESTONES) {
  module('Acceptance | infinite loops', function(hooks) {
    setupApplicationTest(hooks);
    setupMilestones(hooks, [TickTimer]);

    test('avoiding a hanging test-waiter loop', async function(assert) {
      await visit('/loop');

      await advanceTo(TickTimer).andReturn();
      assert.equal(this.element.querySelector('[data-value]')!.textContent, '0');

      await advanceTo(TickTimer).andReturn();
      assert.equal(this.element.querySelector('[data-value]')!.textContent, '1');

      // Cancel the task to kill the loop
      await advanceTo(TickTimer).andCancel();
    });
  });
}
