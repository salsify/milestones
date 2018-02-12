import { visit } from '@ember/test-helpers';
import { advanceTo, setupMilestones } from 'ember-milestones';
import { setupApplicationTest } from 'ember-qunit';
import { module, test } from 'qunit';
import require from 'require';

module('Acceptance | infinite loops', function(hooks) {
  setupApplicationTest(hooks);
  setupMilestones(hooks, ['route:tick#timer']);

  if (require.has('ember-concurrency')) {
    test('avoiding a hanging test-waiter loop', async function(assert) {
      await visit('/loop');

      await advanceTo('route:tick#timer').andReturn();
      assert.equal(this.element.querySelector('[data-value]')!.textContent, '0');

      await advanceTo('route:tick#timer').andReturn();
      assert.equal(this.element.querySelector('[data-value]')!.textContent, '1');

      // Cancel the task to kill the loop
      await advanceTo('route:tick#timer').andCancel();
    });
  }
});
