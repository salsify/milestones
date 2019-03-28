import logger from 'debug';
import { Deferred, defer } from './sys';
import { MilestoneHandle, MilestoneKey, MilestoneTarget as TargetInterface, ResolutionOptions } from '../index';

const debug = logger('@milestones/core:target');

/** @hide */
export default class MilestoneTarget implements TargetInterface {
  private _coordinatorDeferred: Deferred<MilestoneHandle> = defer();

  public constructor(public name: MilestoneKey) {}

  public then<TResult1 = MilestoneHandle, TResult2 = never>(
    onfulfilled?: ((value: MilestoneHandle) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | undefined | null,
  ): Promise<TResult1 | TResult2> {
    debug('awaiting arrival at milestone %s', this.name);
    return this._coordinatorDeferred.promise.then(onfulfilled, onrejected);
  }

  public andReturn(value?: unknown, options?: ResolutionOptions): Promise<void> {
    return this.then(milestone => milestone.return(value, options));
  }

  public andThrow(error: unknown, options?: ResolutionOptions): Promise<void> {
    return this.then(milestone => milestone.throw(error, options));
  }

  public andContinue(options?: ResolutionOptions): Promise<void> {
    return this.then(milestone => milestone.continue(options));
  }

  public andCancel(options?: ResolutionOptions): Promise<void> {
    return this.then(milestone => milestone.cancel(options));
  }

  // Called from the MilestoneCoordinator
  public _resolve(milestone: MilestoneHandle): void {
    this._coordinatorDeferred.resolve(milestone);
  }
}
