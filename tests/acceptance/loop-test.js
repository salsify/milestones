import require from 'require';
import { test, module } from 'qunit';
import { setupApplicationTest } from 'ember-qunit';
import { visit } from '@ember/test-helpers';
import { setupMilestones, advanceTo } from 'ember-milestones';

module('Acceptance | infinite loops', function(hooks) {
  setupApplicationTest(hooks);
  setupMilestones(hooks, ['route:tick#timer']);

  if (require.has('ember-concurrency')) {
    test('avoiding a hanging test-waiter loop', async function(assert) {
      await visit('/loop');

      await advanceTo('route:tick#timer').andReturn();
      assert.equal(this.element.querySelector('[data-value]').innerText, '0');

      await advanceTo('route:tick#timer').andReturn();
      assert.equal(this.element.querySelector('[data-value]').innerText, '1');

      // Cancel the task to kill the loop
      await advanceTo('route:tick#timer').andCancel();
    });
  }
});
