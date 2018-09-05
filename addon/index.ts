import logger from 'debug';
import CoordinatorImpl from 'ember-milestones/-private/milestone-coordinator';

const debugActive = logger('ember-milestones:active');
const debugInactive = logger('ember-milestones:inactive');

/**
 * Activate all milestones in the given array of names. Active milestones will pause
 * when they are reached until instructed on how to proceed via a `MilestoneHandle`.
 *
 * Inactive milestones will pass through to their given callbacks as though the
 * milestone wrapper weren't present at all...
 */
export function activateMilestones(milestones: string[]): MilestoneCoordinator {
  return new CoordinatorImpl(milestones);
}

/**
 * Deactivate all active milestones.
 */
export function deactivateAllMilestones(): void {
  CoordinatorImpl.deactivateAll();
}

/**
 * Advance until the given milestone is reached (continuing past any others hit in
 * the meantime). This function returns a `MilestoneTarget`, which is a thenable
 * object that will resolve to a `MilestoneHandle` once the milestone is reached,
 * but before its callback begins execution. This handle can be used to determine
 * the behavior of the milestone.
 *
 *     let milestone = await advanceTo('my-component#poller');
 *     // Make any assertions about the state of the world here
 *     await milestone.continue();
 *
 * `MilestoneTarget`s also include shortcut methods if you don't need to hold
 * when the milestone is reached and just want to specify the milestone's behavior:
 *
 *     await advanceTo('my-component#poller').andContinue();
 */
export function advanceTo(name: string): MilestoneTarget {
  let coordinator = CoordinatorImpl.forMilestone(name);
  if (!coordinator) {
    throw new Error(`Milestone ${name} isn't currently active.`);
  } else {
    return coordinator.advanceTo(name);
  }
}

/**
 * Marks the given piece of asynchronous code as a milestone. When activated, this
 * will enable a coordinator (e.g. test code) to control the behavior of that code,
 * pausing it and potentially stubbing out its outcome.
 *
 * When not activated, code wrapped in a milestone is immediately invoked as though
 * the wrapper weren't there at all.
 */
export function milestone<T extends PromiseLike<any>>(name: string, callback: () => T): T;
export function milestone(name: string): PromiseLike<void>;
export function milestone(name: string, callback?: () => any): PromiseLike<any> {
  let coordinator = CoordinatorImpl.forMilestone(name);
  let action = callback || (() => Promise.resolve());
  if (coordinator) {
    debugActive('reached active milestone %s', name);
    return coordinator._milestoneReached(name, action);
  } else {
    debugInactive('skipping inactive milestone %s', name);
    return action();
  }
}

/**
 * Set up the given list of milestones for the current test context. This is shorthand
 * for calling `activateMilestones` in a `beforeEach()` block and `deactivateAll()` in
 * an `afterEach` block.
 *
 * You may specify an `as` option to expose the `MilestoneCoordinator` instance for
 * these milestones on the test context under the given key, e.g.
 *
 *     module('My Module', function(hooks) {
 *       setupMilestones(hooks, ['one', 'two'], { as: 'milestones' });
 *       test('My Test', async function(assert) {
 *         await this.milestones.advanceTo('one');
 *       });
 *     });
 *
 * In most cases, using the importable `advanceTo` should mean you won't need to
 * use the `as` parameter.
 */
export function setupMilestones(hooks: TestHooks, names: string[], options: MilestoneTestOptions = {}) {
  let milestones: MilestoneCoordinator;

  hooks.beforeEach(function(this: any) {
    milestones = activateMilestones(names);

    if (options.as) {
      this[options.as] = milestones;
    }
  });

  hooks.afterEach(function() {
    milestones.deactivateAll();
  });
}

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
  andReturn(value?: any, options?: ResolutionOptions): Promise<void>;

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
  return(value?: any, options?: ResolutionOptions): Promise<void>;

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

/** @hide */
export interface CancelableDeferred<T = any> {
  promise: Promise<T>;
  cancel(reason?: string): void;
  resolve(value?: T): void;
  reject(error?: any): void;
}

/** @hide */
export interface TestHooks {
  beforeEach(callback: () => any): void;
  afterEach(callback: () => any): void;
}

/** @hide */
export interface MilestoneTestOptions {
  /**
   * An optional name to store a `MilestoneCoordinator` under on the test
   * context, if you need direct access to it.
   */
  as?: string;
}
