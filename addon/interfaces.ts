/**
 * A `MilestoneCoordinator` is the result of an `activateMilestones` call,
 * which provides the ability to interact with the milestones you've activated
 * and subsequently deactivate them.
 *
 * In most cases, you can simply use the importable `advanceTo` and
 * `deactivateAllMilestones` functions from the `'ember-milestones'` module
 * rather than interacting directly with a `MilestoneCoordinator` instance.
 */
export interface MilestoneCoordinator {
  /**
   * Advance until the given milestone is reached, continuing past any others
   * that are active for this coordinator in the meantime.
   */
  advanceTo(name: string): MilestoneTarget;

  /**
   * Deactivate all milestones associated with this coordinator.
   */
  deactivateAll(): void;
}

/**
 * A `MilestoneTarget` represents the 'goal' of proceeding to a certain
 * milestone. It's a `PromiseLike` object that resolves to a `MilestoneHandle`
 * when its associated milestone is reached.
 *
 * A `MilestoneTarget` also contains shortcut methods for easily invoking
 * a particular behavior when the milestone is reached.
 */
export interface MilestoneTarget extends PromiseLike<MilestoneHandle> {
  /**
   * Return the given value when the milestone is reached. The following two
   * lines are equivalent:
   *
   *     await advanceTo('milestone').andReturn(value);
   *     await advanceTo('milestone').then(m => m.return(value));
   */
  andReturn(value: any, options?: ResolutionOptions): Promise<void>;

  /**
   * Throw the given error when the milestone is reached. The following two
   * lines are equivalent:
   *
   *     await advanceTo('milestone').andThrow(error);
   *     await advanceTo('milestone').then(m => m.throw(error));
   */
  andThrow(error: any, options?: ResolutionOptions): Promise<void>;

  /**
   * Invoke the milestone's original callback when reached. The following two
   * lines are equivalent:
   *
   *     await advanceTo('milestone').andContinue();
   *     await advanceTo('milestone').then(m => m.continue());
   */
  andContinue(options?: ResolutionOptions): Promise<void>;

  /**
   * Trigger a task cancellation when the milestone is reached. The following two
   * lines are equivalent:
   *
   *     await advanceTo('milestone').andCancel();
   *     await advanceTo('milestone').then(m => m.cancel());
   *
   * Note that cancellation is only possible when `ember-concurrency` is present.
   */
  andCancel(options?: ResolutionOptions): Promise<void>;
}

/**
 * A `MilestoneHandle` represents a milestone that your application code is
 * currently paused at. It provides methods for determining how that milestone
 * will ultimately resolve, whether you invoke the original behavior or stub
 * out a different return value, error, or cancellation.
 */
export interface MilestoneHandle {
  /**
   * Settle this milestone by invoking its original callback. The promise
   * returned by this method will resolve once the result of the original
   * callback has settled.
   */
  continue(options?: ResolutionOptions): Promise<void>;

  /**
   * Settle this milestone by resolving its promise with the given value.
   */
  return(value: any, options?: ResolutionOptions): Promise<void>;

  /**
   * Settle this milestone by rejecting its promise with the given error.
   */
  throw(error: any, options?: ResolutionOptions): Promise<void>;

  /**
   * Settle this milestone by causing it to behave as a canceled task.
   *
   * Note that cancellation is only available if `ember-concurrency` is
   * present.
   */
  cancel(options?: ResolutionOptions): Promise<void>;
}

export interface ResolutionOptions {
  /**
   * Whether to resolve the promise returned by a `MilestoneHandle` method as
   * soon as possible or not.
   *
   * By default, resolution will be scheduled in a subsequent task so that any
   * other pending tasks have a chance to execute. If you set `immediate: true`,
   * however, the resolution will happen immediately, queueing a microtask.
   */
  immediate?: boolean;
}

export interface CancelableDeferred<T = any> {
  promise: Promise<T>;
  cancel(reason?: string): void;
  resolve(value?: T): void;
  reject(error?: any): void;
}

export interface TestHooks {
  beforeEach(callback: () => any): void;
  afterEach(callback: () => any): void;
}

export interface MilestoneTestOptions {
  /**
   * An optional name to store a `MilestoneCoordinator` under on the test
   * context, if you need direct access to it.
   */
  as?: string;
}
