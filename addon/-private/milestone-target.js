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
    return this._chain('return', value, options);
  }

  andThrow(error, options) {
    return this._chain('throw', error, options);
  }

  andContinue(options) {
    return this._chain('continue', options);
  }

  andCancel(options) {
    return this._chain('cancel', options);
  }

  _chain(method, ...params) {
    return this.then(milestone => milestone[method](...params)).then(() => undefined);
  }

  _resolve(milestone) {
    this._coordinatorDeferred.resolve(milestone);
  }
}
