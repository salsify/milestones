import { setupMilestones } from 'ember-milestones';
import { ACTIVE_COORDINATORS } from 'ember-milestones/-private/milestone-coordinator';
import { module, test } from 'qunit';

module('Unit | setup-milestones', function() {
  module('activating milestones', function(hooks) {
    setupMilestones(hooks, ['one']);
    setupMilestones(hooks, ['two', 'three']);

    test('milestones are turned on', async function(assert) {
      assert.deepEqual(Object.keys(ACTIVE_COORDINATORS), ['one', 'two', 'three']);
      assert.notEqual(ACTIVE_COORDINATORS.one, ACTIVE_COORDINATORS.two);
      assert.equal(ACTIVE_COORDINATORS.two, ACTIVE_COORDINATORS.three);
    });
  });

  module('with a named coordinator', async function(hooks) {
    setupMilestones(hooks, ['one'], { as: 'coordinator' });

    test('the coordinator can be referenced', async function(assert) {
      assert.equal((this as any).coordinator, ACTIVE_COORDINATORS.one);
    });
  });
});
