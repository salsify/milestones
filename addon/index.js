import MilestoneCoordinator from 'ember-milestones/-private/milestone-coordinator';
import logger from 'ember-debug-logger';

const debugActive = logger('ember-milestones:active');
const debugInactive = logger('ember-milestones:inactive');

export function activateMilestones(milestones) {
  return new MilestoneCoordinator(milestones);
}

export function deactivateAllMilestones() {
  MilestoneCoordinator.deactivateAll();
}

export function advanceTo(name) {
  let coordinator = MilestoneCoordinator.forMilestone(name);
  if (!coordinator) {
    throw new Error(`Milestone ${name} isn't currently active.`);
  } else {
    return coordinator.advanceTo(name);
  }
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

export function setupMilestones(hooks, names, options = {}) {
  let milestones;

  hooks.beforeEach(function() {
    milestones = activateMilestones(names);

    if (options.as) {
      this[options.as] = milestones;
    }
  });

  hooks.afterEach(function() {
    milestones.deactivateAll();
  });
}
