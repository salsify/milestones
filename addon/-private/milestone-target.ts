import logger from 'debug';
import {
  MilestoneHandle,
  MilestoneTarget as IMilestoneTarget,
  ResolutionOptions,
} from 'ember-milestones';
import RSVP, { defer } from 'rsvp';

const debug = logger('ember-milestones:target');

/** @hide */
export default class MilestoneTarget implements IMilestoneTarget {
  private _coordinatorDeferred: RSVP.Deferred<MilestoneHandle> = defer();

  constructor(
    public name: string,
  ) {}

  public then<TResult1 = MilestoneHandle, TResult2 = never>(
    onfulfilled?: ((value: MilestoneHandle) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null,
  ): Promise<TResult1 | TResult2> {
    debug('awaiting arrival at milestone %s', this.name);
    return this._coordinatorDeferred.promise.then(onfulfilled, onrejected);
  }

  public andReturn(value?: any, options?: ResolutionOptions): Promise<void> {
    return this.then((milestone) => milestone.return(value, options));
  }

  public andThrow(error: any, options?: ResolutionOptions): Promise<void> {
    return this.then((milestone) => milestone.throw(error, options));
  }

  public andContinue(options?: ResolutionOptions) {
    return this.then((milestone) => milestone.continue(options));
  }

  public andCancel(options?: ResolutionOptions) {
    return this.then((milestone) => milestone.cancel(options));
  }

  // Called from the MilestoneCoordinator
  public _resolve(milestone: MilestoneHandle) {
    this._coordinatorDeferred.resolve(milestone);
  }
}
