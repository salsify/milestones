import { module, test } from 'qunit';
import MilestoneCoordinator, { ACTIVE_COORDINATORS } from 'ember-milestones/-private/milestone-coordinator';

module('Unit | milestone-coordinator', function() {
  test('deactivating a single coordinator', function(assert) {
    let coordinator = new MilestoneCoordinator(['one', 'two']);

    assert.equal(ACTIVE_COORDINATORS.one, coordinator);
    assert.equal(ACTIVE_COORDINATORS.two, coordinator);

    coordinator.deactivateAll();

    assert.deepEqual(ACTIVE_COORDINATORS, {});
  });

  test('deactivating all coordinators', function(assert) {
    let first = new MilestoneCoordinator(['one']);
    let second = new MilestoneCoordinator(['two', 'three']);

    assert.equal(ACTIVE_COORDINATORS.one, first);
    assert.equal(ACTIVE_COORDINATORS.two, second);
    assert.equal(ACTIVE_COORDINATORS.three, second);

    MilestoneCoordinator.deactivateAll();

    assert.deepEqual(ACTIVE_COORDINATORS, {});
  });

  test('looking up the coordinator for a specific milestone', function(assert) {
    let coordinator = new MilestoneCoordinator(['one', 'two']);

    assert.equal(MilestoneCoordinator.forMilestone('one'), coordinator);
    assert.equal(MilestoneCoordinator.forMilestone('two'), coordinator);
    assert.equal(MilestoneCoordinator.forMilestone('three'), undefined);

    coordinator.deactivateAll();
  });
});
