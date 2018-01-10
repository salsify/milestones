import { Promise } from 'rsvp';
import { assert } from '@ember/debug';
import { next } from '@ember/runloop';

export default class Milestone {
  constructor(name, coordinator, action, deferred) {
    this.name = name;
    this.resolution = false;

    this._coordinator = coordinator;
    this._action = action;
    this._deferred = deferred;
  }

  continue(options) {
    return this._complete('continue', options, () => {
      let action = this._action;
      this._deferred.resolve(action());
    });
  }

  throw(error, options) {
    return this._complete('throw', options, () => {
      this._deferred.reject(error);
    });
  }

  return(value, options) {
    return this._complete('return', options, () => {
      this._deferred.resolve(value);
    });
  }

  _complete(resolution, options = {}, finalizer) {
    assert(`Multiple resolutions for milestone ${this.name}`, !this.resolution || this.resolution === resolution);

    if (!this.resolution) {
      this.resolution = resolution;
      this._coordinator._milestoneCompleted(this);

      finalizer();
    }

    return new Promise((resolve) => {
      let doResolve = options.immediate ? () => resolve() : () => next(resolve);
      return this._deferred.promise.then(doResolve, doResolve);
    });
  }
}
