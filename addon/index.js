import MilestoneCoordinator from 'ember-milestones/-private/milestone-coordinator';
import logger from 'ember-debug-logger';

const debugActive = logger('ember-milestones:active');
const debugInactive = logger('ember-milestones:inactive');

export function activateMilestones(milestones) {
  return new MilestoneCoordinator(milestones);
}

export function milestone(name, action) {
  let coordinator = MilestoneCoordinator.forMilestone(name);
  if (coordinator) {
    debugActive('reached active milestone %s', name);
    return coordinator._milestoneReached(name, action);
  } else {
    debugInactive('skipping inactive milestone %s', name);
    return action();
  }
}

export function setupMilestones(hooks, milestones) {
  hooks.beforeEach(function() {
    this.milestones = activateMilestones(milestones);
  });

  hooks.afterEach(function() {
    this.milestones.deactivateAll();
  });
}
