import { defer, assert, run, Deferred } from './sys';
import MilestoneCoordinator from './milestone-coordinator';
import { MilestoneHandle as HandleInterface, MilestoneKey, ResolutionOptions } from '../index';

type Resolution = 'continue' | 'throw' | 'return' | 'cancel';

/** @hide */
export default class MilestoneHandle implements HandleInterface {
  private resolution: Resolution | null = null;

  public constructor(
    public name: MilestoneKey,
    private _coordinator: MilestoneCoordinator,
    private _action: () => unknown,
    private _deferred: Deferred<unknown>,
  ) {}

  public continue(options?: ResolutionOptions): Promise<void> {
    return this._complete('continue', options, () => {
      let action = this._action;
      this._deferred.resolve(action());
    });
  }

  public throw(error: unknown, options?: ResolutionOptions): Promise<void> {
    return this._complete('throw', options, () => this._deferred.reject(error));
  }

  public return(value?: unknown, options?: ResolutionOptions): Promise<void> {
    return this._complete('return', options, () => this._deferred.resolve(value));
  }

  public cancel(options?: ResolutionOptions): Promise<void> {
    assert(!!this._deferred.cancel, 'Underlying milestones system implementation does not support cancelation');

    return this._complete('cancel', options, () => this._deferred.cancel!());
  }

  private _complete(resolution: Resolution, options: ResolutionOptions = {}, finalizer: () => void): Promise<void> {
    assert(
      !this.resolution || resolution === this.resolution,
      `Multiple resolutions for milestone '${this.name.toString()}'`,
    );

    if (!this.resolution) {
      this.resolution = resolution;
      this._coordinator._milestoneCompleted(this);
      run(finalizer);
    }

    let { promise, resolve } = defer<void>();
    let doResolve = options.immediate ? () => resolve() : () => setTimeout(() => resolve());
    this._deferred.promise.then(doResolve, doResolve);
    return promise;
  }
}
