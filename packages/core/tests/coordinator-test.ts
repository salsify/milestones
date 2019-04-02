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

  test('looking up the coordinator for a specific key', () => {
    let coordinator = new MilestoneCoordinator(['one', 'two']);

    expect(MilestoneCoordinator.forKey('one')).to.equal(coordinator);
    expect(MilestoneCoordinator.forKey('two')).to.equal(coordinator);
    expect(MilestoneCoordinator.forKey('three')).to.equal(undefined);

    coordinator.deactivateAll();
  });

  test('looking up the coordinator for a given id and set of tags', () => {
    let coordinator1 = new MilestoneCoordinator(['one', 'two']);
    let coordinator2 = new MilestoneCoordinator(['three', 'four']);

    expect(MilestoneCoordinator.forMilestone('one', ['three'])).to.equal(coordinator1);
    expect(MilestoneCoordinator.forMilestone('five', ['one', 'three'])).to.equal(coordinator1);
    expect(MilestoneCoordinator.forMilestone('five', ['three', 'one'])).to.equal(coordinator2);
    expect(MilestoneCoordinator.forMilestone('five', ['six', 'seven'])).to.equal(undefined);

    coordinator1.deactivateAll();
    coordinator2.deactivateAll();
  });
});
