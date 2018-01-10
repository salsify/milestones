import require from 'require';
import { test } from 'qunit';
import { activateMilestones } from 'ember-milestones';
import moduleForAcceptance from '../../tests/helpers/module-for-acceptance';

moduleForAcceptance('Acceptance | infinite loops', {
  beforeEach() {
    this.milestones = activateMilestones(['route:tick#timer']);
  },

  afterEach() {
    this.milestones.deactivateAll();
  }
});

if (require.has('ember-concurrency')) {
  test('avoiding a hanging test-waiter loop', async function(assert) {
    await visit('/loop');

    await this.milestones.advanceTo('route:tick#timer').andReturn();
    assert.equal(find('[data-value]').text(), '0');

    await this.milestones.advanceTo('route:tick#timer').andReturn();
    assert.equal(find('[data-value]').text(), '1');

    // Because pending milestones don't add a test waiter, the test completes without a fuss
  });
}
