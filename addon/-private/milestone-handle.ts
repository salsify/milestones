import { assert } from '@ember/debug';
import { next, run } from '@ember/runloop';
import { Promise } from 'rsvp';

import MilestoneCoordinator from 'ember-milestones/-private/milestone-coordinator';

import {
  CancelableDeferred,
  MilestoneHandle as IMilestoneHandle,
  ResolutionOptions,
} from 'ember-milestones';

type Resolution = 'continue' | 'throw' | 'return' | 'cancel';

/** @hide */
export default class MilestoneHandle implements IMilestoneHandle {
  private resolution: Resolution | null = null;

  constructor(
    public name: string,
    private _coordinator: MilestoneCoordinator,
    private _action: () => any,
    private _deferred: CancelableDeferred,
  ) {}

  public continue(options?: ResolutionOptions): Promise<void> {
    return this._complete('continue', options, () => {
      let action = this._action;
      this._deferred.resolve(action());
    });
  }

  public throw(error: any, options?: ResolutionOptions): Promise<void> {
    return this._complete('throw', options, () => {
      this._deferred.reject(error);
    });
  }

  public return(value?: any, options?: ResolutionOptions): Promise<void> {
    return this._complete('return', options, () => {
      this._deferred.resolve(value);
    });
  }

  public cancel(options?: ResolutionOptions) {
    return this._complete('cancel', options, () => {
      this._deferred.cancel();
    });
  }

  private _complete(resolution: Resolution, options: ResolutionOptions = {}, finalizer: () => void): Promise<void> {
    assert(`Multiple resolutions for milestone ${this.name}`, !this.resolution || this.resolution === resolution);

    if (!this.resolution) {
      this.resolution = resolution;
      this._coordinator._milestoneCompleted(this);

      run(finalizer);
    }

    return new Promise((resolve) => {
      let doResolve = options.immediate ? () => resolve() : () => next(null, () => resolve());
      return this._deferred.promise.then(doResolve, doResolve);
    });
  }
}
