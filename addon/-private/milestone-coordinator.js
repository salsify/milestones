import { assert } from '@ember/debug';
import { defer } from 'rsvp';
import MilestoneTarget from './milestone-target';
import Milestone from './milestone';

export const MILESTONE_COORDINATORS = Object.create(null);

export default class MilestoneCoordinator {
  constructor(names) {
    names.forEach((name) => {
      assert(`Milestone '${name}' is already active.`, !MILESTONE_COORDINATORS[name]);
      MILESTONE_COORDINATORS[name] = this;
    });

    this.names = names;
    this._pendingActions = Object.create(null);
    this._nextTarget = null;
    this._pausedMilestone = null;
  }

  static forMilestone(name) {
    return MILESTONE_COORDINATORS[name];
  }

  advanceTo(name) {
    assert(`Milestone '${name}' is not active.`, this.names.indexOf(name) !== -1);
    let target = new MilestoneTarget(name);

    this._nextTarget = target;
    this._continueAll({ except: name });

    let pending = this._pendingActions[name];
    if (pending) {
      delete this._pendingActions[name];
      this._targetReached(target, pending.deferred, pending.action);
    }

    return target;
  }

  deactivateAll() {
    this._continueAll();

    this.names.forEach((name) => {
      MILESTONE_COORDINATORS[name] = undefined;
    });

    this.names = [];
  }

  // Called from milestone()
  _milestoneReached(name, action) {
    let target = this._nextTarget;

    // If we're already targeting another milestone, just pass through
    if (target && target.name !== name) {
      return action();
    }

    let deferred = defer();
    if (target && target.name === name) {
      this._targetReached(target, deferred, action);
    } else {
      assert(`Milestone '${name}' is already pending.`, !this._pendingActions[name]);
      this._pendingActions[name] = { deferred, action };
    }
    return deferred.promise;
  }

  _targetReached(target, deferred, action) {
    this._nextTarget = null;
    this._pausedMilestone = new Milestone(target.name, this, action, deferred);

    target._resolve(this._pausedMilestone);
  }

  // Called by Milestone instances
  _milestoneCompleted(milestone) {
    if (this._pausedMilestone === milestone) {
      this._pausedMilestone = null;
    }
  }

  _continueAll({ except } = {}) {
    let paused = this._pausedMilestone;
    if (paused && paused.name !== except && !paused.settled) {
      paused.continue();
    }

    Object.keys(this._pendingActions).forEach((key) => {
      if (key === except) { return; }

      let { deferred, action } = this._pendingActions[key];
      deferred.resolve(action());
      delete this._pendingActions[key];
    });
  }
}
