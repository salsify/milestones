import EmberObject from '@ember/object';
import { assert } from '@ember/debug';
import { defer, resolve } from 'rsvp';

export function activateMilestones(milestones) {
  return new MilestoneCoordinator(milestones);
}

export function milestone(name, callback) {
  if (ACTIVE_MILESTONES[name]) {
    return ACTIVE_MILESTONES[name]._dispatch(name, callback);
  } else {
    return callback();
  }
}

export function setupMilestones(hooks, milestones) {
  hooks.beforeEach(function() {
    this.milestones = activateMilestones(milestones);
  });

  hooks.afterEach(function() {
    this.milestones.deactivate();
  });
}

const ACTIVE_MILESTONES = Object.create(null);

class MilestoneCoordinator extends EmberObject {
  constructor(names) {
    super();

    names.forEach((name) => {
      assert(!ACTIVE_MILESTONES[name], `Milestone '${name}' is already active.`);
      ACTIVE_MILESTONES[name] = this;
    });

    this.names = names;
    this._pendingMilestones = Object.create(null);
    this._targets = [];
    this._at = null;
  }

  then() {
    let chain = this._targets.reduce((previous, target) => {
      return previous.then(() => target._coordinatorDeferred.promise)
    }, resolve());

    return chain.then(...arguments);
  }

  advanceTo(name) {
    assert(`Milestone '${name}' is not active.`, this.names.indexOf(name) !== -1);
    let { deferred, action } = this._pendingMilestones[name] || {};

    this._continueAllExcept(name);

    let target = new MilestoneTarget(name, this, deferred, action);

    if (!deferred) {
      this._targets.push(target);
    }

    return target;
  }

  _continueAllExcept(name) {
    Object.keys(this._pendingMilestones).forEach((key) => {
      if (key !== name) {
        let pending = this._pendingMilestones[key];
        pending.deferred.resolve(pending.action());
      }
      delete this._pendingMilestones[key];
    });
  }

  unpause() {
    assert(`Can't unpause when not stopped at a milestone`, this._at);
    let target = this._at;
    this._at = null;
    return target;
  }

  deactivate() {
    if (this._at) {
      this._at.andContinue();
    }

    this._continueAllExcept(null);

    this.names.forEach((name) => {
      ACTIVE_MILESTONES[name] = undefined;
    });

    this.names = [];
  }

  _dispatch(name, action) {
    let target = this._targets[0];
    if (!target) {
      assert(`Milestone '${name}' is already pending.`, !this._pendingMilestones[name]);
      let deferred = defer();
      this._pendingMilestones[name] = { deferred, action };
      return deferred.promise;
    } else if (target.name === name) {
      this._targets.shift();
      return target._targetReached(action);
    } else {
      return action();
    }
  }
}

class MilestoneTarget {
  constructor(name, coordinator, milestoneDeferred = defer(), milestoneAction = null) {
    this.name = name;
    this._coordinator = coordinator;
    this._coordinatorDeferred = defer();
    this._targetReachedHandler = null;
    this._milestoneDeferred = milestoneDeferred;
    this._milestoneAction = milestoneAction;
  }

  then() {
    assert(`You must designate an action when milestone ${this.name} is hit before you can advance to it.`);
  }

  andPause() {
    return this._setTargetReachedHandler(() => {
      assert(`Can't pause at two milestones at once from the same coordinator.`, !this._coordinator._at);
      this._coordinator._at = this;
    });
  }

  andReturn(value) {
    return this._setTargetReachedHandler(() => this._milestoneDeferred.resolve(value));
  }

  andThrow(error) {
    return this._setTargetReachedHandler(() => this._milestoneDeferred.reject(error));
  }

  andContinue() {
    return this._setTargetReachedHandler(() => this._milestoneDeferred.resolve(this._milestoneAction()));
  }

  _targetReached(action) {
    this._milestoneAction = action;

    if (this._targetReachedHandler) {
      this._executeOnReachedHandler();
    }

    return this._milestoneDeferred.promise;
  }

  _setTargetReachedHandler(handler) {
    this._targetReachedHandler = handler;

    if (this._milestoneAction) {
      this._executeOnReachedHandler();
    }

    return this._coordinator;
  }

  _executeOnReachedHandler() {
    this._targetReachedHandler();
    this._coordinatorDeferred.resolve();
  }
}
