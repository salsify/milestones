import { describe, test } from 'mocha';
import { expect } from 'chai';
import MilestoneCoordinator, { ACTIVE_COORDINATORS } from '../src/-private/milestone-coordinator';

describe('MilestoneCoordinator', () => {
  test('deactivating a single coordinator', () => {
    let coordinator = new MilestoneCoordinator(['one', 'two']);

    expect(ACTIVE_COORDINATORS.one).to.equal(coordinator);
    expect(ACTIVE_COORDINATORS.two).to.equal(coordinator);

    coordinator.deactivateAll();

    expect(ACTIVE_COORDINATORS).to.deep.equal({});
  });

  test('deactivating all coordinators', () => {
    let first = new MilestoneCoordinator(['one']);
    let second = new MilestoneCoordinator(['two', 'three']);

    expect(ACTIVE_COORDINATORS.one).to.equal(first);
    expect(ACTIVE_COORDINATORS.two).to.equal(second);
    expect(ACTIVE_COORDINATORS.three).to.equal(second);

    MilestoneCoordinator.deactivateAll();

    expect(ACTIVE_COORDINATORS).to.deep.equal({});
  });

  test('looking up the coordinator for a specific milestone', () => {
    let coordinator = new MilestoneCoordinator(['one', 'two']);

    expect(MilestoneCoordinator.forMilestone('one')).to.equal(coordinator);
    expect(MilestoneCoordinator.forMilestone('two')).to.equal(coordinator);
    expect(MilestoneCoordinator.forMilestone('three')).to.equal(undefined);

    coordinator.deactivateAll();
  });
});
