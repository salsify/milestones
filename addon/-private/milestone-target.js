import { defer } from 'rsvp';
import logger from 'ember-debug-logger';

const debug = logger('ember-milestones:target');

export default class MilestoneTarget {
  constructor(name) {
    this.name = name;
    this._coordinatorDeferred = defer();
  }

  then() {
    debug('awaiting arrival at milestone %s', this.name);
    return this._coordinatorDeferred.promise.then(...arguments);
  }

  andReturn(value, options) {
    return this._chain((milestone) => {
      return milestone.return(value, options);
    });
  }

  andThrow(error, options) {
    return this._chain((milestone) => {
      return milestone.throw(error, options);
    });
  }

  andContinue(options) {
    return this._chain((milestone) => {
      return milestone.continue(options);
    });
  }

  andCancel(options) {
    return this._chain((milestone) => {
      return milestone.cancel(options);
    });
  }

  _chain(f) {
    return this.then(f).then(() => {}, () => {});
  }

  _resolve(milestone) {
    this._coordinatorDeferred.resolve(milestone);
  }
}
