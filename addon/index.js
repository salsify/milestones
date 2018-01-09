import EmberObject from '@ember/object';
import { assert } from '@ember/debug';
import { next } from '@ember/runloop';
import { defer, Promise } from 'rsvp';
import logger from 'ember-debug-logger';

const debugActive = logger('ember-milestones:active');
const debugInactive = logger('ember-milestones:inactive');
const debugCoordinator = logger('ember-milestones:coordinator');

export function activateMilestones(milestones) {
  return new MilestoneCoordinator(milestones);
}

export function milestone(name, callback) {
  if (MILESTONE_COORDINATORS[name]) {
    debugActive('reached active milestone %s', name);
    return MILESTONE_COORDINATORS[name]._dispatch(name, callback);
  } else {
    debugInactive('skipping inactive milestone %s', name);
    return callback();
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

const MILESTONE_COORDINATORS = Object.create(null);

class MilestoneCoordinator extends EmberObject {
  constructor(names) {
    super();

    names.forEach((name) => {
      assert(`Milestone '${name}' is already active.`, !MILESTONE_COORDINATORS[name]);
      MILESTONE_COORDINATORS[name] = this;
    });

    this.names = names;
    this._pendingActions = Object.create(null);
    this._coordinatorPromise = null;
    this._nextTarget = null;
    this._at = null;
  }

  advanceTo(name) {
    assert(`Milestone '${name}' is not active.`, this.names.indexOf(name) !== -1);
    let { deferred, action } = this._pendingActions[name] || {};
    let target = new MilestoneTarget(name, this);

    delete this._pendingActions[name];

    this._nextTarget = target;
    this._continueAll({ except: name });

    if (action) {
      target._targetReached(deferred, action);
    }

    return target;
  }

  _continueAll({ except } = {}) {
    if (this._at && this._at.target.name !== except && !this._at.resolution) {
      this._at.continue();
    }

    Object.keys(this._pendingActions).forEach((key) => {
      if (key !== except) {
        let pending = this._pendingActions[key];
        pending.deferred.resolve(pending.action());
      }
      delete this._pendingActions[key];
    });
  }

  deactivateAll() {
    this._continueAll();

    this.names.forEach((name) => {
      MILESTONE_COORDINATORS[name] = undefined;
    });

    this.names = [];
  }

  _dispatch(name, action) {
    let target = this._nextTarget;
    if (!target) {
      assert(`Milestone '${name}' is already pending.`, !this._pendingActions[name]);
      let deferred = defer(`ember-milestones:milestone#${name}`);
      this._pendingActions[name] = { deferred, action };
      return deferred.promise;
    } else if (target.name === name) {
      let deferred = defer(`ember-milestones:reached#${name}`);
      target._targetReached(deferred, action);
      return deferred.promise;
    } else {
      return action();
    }
  }
}

class MilestoneTarget {
  constructor(name, coordinator) {
    this.name = name;
    this._coordinator = coordinator;
    this._coordinatorDeferred = defer(`ember-milestones:coordinator#${name}`);
  }

  then() {
    debugCoordinator('awaiting milestone arrival %s', this.name);
    return this._coordinatorDeferred.promise.then(...arguments);
  }

  andReturn(value, options) {
    return this._chain(milestone => milestone.return(value, options));
  }

  andThrow(error, options) {
    return this._chain(milestone => milestone.throw(error, options));
  }

  andContinue(options) {
    return this._chain(milestone => milestone.continue(options));
  }

  _chain(f) {
    return this.then(f).then(() => {}, () => {});
  }

  _targetReached(deferred, action) {
    if (this._coordinator._nextTarget === this) {
      this._coordinator._nextTarget = null;
    }

    let milestone = new Milestone(this, action, deferred);

    this._coordinator._at = milestone;
    this._coordinatorDeferred.resolve(milestone);
  }
}

class Milestone {
  constructor(target, action, deferred) {
    this.target = target;
    this.action = action;
    this.deferred = deferred;
    this.resolution = null;
  }

  continue(options) {
    let { action } = this;
    return this._complete('continue', options, () => {
      this.deferred.resolve(action());
    });
  }

  throw(error, options) {
    return this._complete('throw', options, () => {
      this.deferred.reject(error);
    });
  }

  return(value, options) {
    return this._complete('return', options, () => {
      this.deferred.resolve(value);
    });
  }

  _complete(resolution, options = {}, f) {
    assert(`Conflicting resolutions for milestone ${this.target.name}`, !this.resolution || this.resolution === resolution);

    if (!this.resolution) {
      this.resolution = resolution;

      f();

      if (this.target._coordinator._at === this) {
        this.target._coordinator._at = null;
      }
    }

    return new Promise((resolve) => {
      let doResolve = options.immediate ? () => resolve() : () => next(resolve);
      return this.deferred.promise.then(doResolve, doResolve);
    });
  }
}
