import logger from 'debug';
import CoordinatorImpl from './-private/milestone-coordinator';
export { registerSystem, resetSystem } from './-private/sys';

const debugActive = logger('@milestones/core:active');
const debugInactive = logger('@milestones/core:inactive');

/**
 * Activate all milestones in the given array of names. Active milestones will pause
 * when they are reached until instructed on how to proceed via a `MilestoneHandle`.
 *
 * Inactive milestones will pass through to their given callbacks as though the
 * milestone wrapper weren't present at all...
 */
export function activateMilestones(milestones: MilestoneKey[]): MilestoneCoordinator {
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
 * ```ts
 * let milestone = await advanceTo(MyMilestone);
 * // Make any assertions about the state of the world here
 * await milestone.continue();
 * ```
 *
 * `MilestoneTarget`s also include shortcut methods if you don't need to hold
 * when the milestone is reached and just want to specify the milestone's behavior:
 *
 * ```ts
 * await advanceTo(MyMilestone).andContinue();
 * ```
 */
export function advanceTo(name: MilestoneKey): MilestoneTarget {
  let coordinator = CoordinatorImpl.forMilestone(name);
  if (!coordinator) {
    throw new Error(`Milestone ${name.toString()} isn't currently active.`);
  } else {
    return coordinator.advanceTo(name);
  }
}

export interface MilestoneOptions {
  /**
   * Tags for identifiying this milestone as part of one or
   * more groups.
   */
  tags?: MilestoneKey[];
}

/**
 * Marks the given piece of asynchronous code as a milestone. When activated, this
 * will enable a coordinator (e.g. test code) to control the behavior of that code,
 * pausing it and potentially stubbing out its outcome.
 *
 * When not activated, code wrapped in a milestone is immediately invoked as though
 * the wrapper weren't there at all.
 */
export function milestone<T extends PromiseLike<unknown>>(name: MilestoneKey, callback: () => T): T;
export function milestone(name: MilestoneKey): PromiseLike<void>;
export function milestone(name: MilestoneKey, callback?: () => PromiseLike<unknown>): PromiseLike<unknown> {
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
 * A valid key for a milestone, either a string or a symbol.
 */
export type MilestoneKey = string | symbol;

/**
 * A `MilestoneCoordinator` is the result of an `activateMilestones` call,
 * which provides the ability to interact with the milestones you've activated
 * and subsequently deactivate them.
 *
 * In most cases, you can simply use the importable `advanceTo` and
 * `deactivateAllMilestones` functions from the `'@milestones/core'` module
 * rather than interacting directly with a `MilestoneCoordinator` instance.
 */
export interface MilestoneCoordinator {
  /**
   * Advance until the given milestone is reached, continuing past any others
   * that are active for this coordinator in the meantime.
   */
  advanceTo(key: MilestoneKey): MilestoneTarget;

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
   * ```ts
   * await advanceTo(Milestone).andReturn(value);
   * await advanceTo(Milestone).then(m => m.return(value));
   * ```
   */
  andReturn(value?: unknown, options?: ResolutionOptions): Promise<void>;

  /**
   * Throw the given error when the milestone is reached. The following two
   * lines are equivalent:
   *
   * ```ts
   * await advanceTo(Milestone).andThrow(error);
   * await advanceTo(Milestone).then(m => m.throw(error));
   * ```
   */
  andThrow(error: unknown, options?: ResolutionOptions): Promise<void>;

  /**
   * Invoke the milestone's original callback when reached. The following two
   * lines are equivalent:
   *
   * ```ts
   * await advanceTo(Milestone).andContinue();
   * await advanceTo(Milestone).then(m => m.continue());
   * ```
   */
  andContinue(options?: ResolutionOptions): Promise<void>;

  /**
   * Trigger a task cancellation when the milestone is reached. The following two
   * lines are equivalent:
   *
   * ```ts
   * await advanceTo(Milestone).andCancel();
   * await advanceTo(Milestone).then(m => m.cancel());
   * ```
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
  return(value?: unknown, options?: ResolutionOptions): Promise<void>;

  /**
   * Settle this milestone by rejecting its promise with the given error.
   */
  throw(error: unknown, options?: ResolutionOptions): Promise<void>;

  /**
   * Settle this milestone by causing it to behave as a canceled task.
   *
   * Note that cancellation is only available if `ember-concurrency` is
   * present.
   */
  cancel(options?: ResolutionOptions): Promise<void>;
}

/** @hide */
export interface ResolutionOptions {
  /**
   * Whether to resolve the promise returned by a `MilestoneHandle` method as
   * soon as possible or not.
   *
   * By default, resolution will be scheduled in a subsequent task so that any
   * other pending tasks have a chance to execute. If you set `immediate: true`,
   * however, the resolution will be queued in a microtask as soon as the milestone
   * itself resolves to a value.
   */
  immediate?: boolean;
}

/**
 * Set up the given list of milestones for the current test context. This is shorthand
 * for calling `activateMilestones` in a `beforeEach()` block and `deactivateAll()` in
 * an `afterEach` block.
 */
export function setupMilestones(keys: MilestoneKey[]): void;
export function setupMilestones(hooks: TestHooks, keys: MilestoneKey[]): void;
export function setupMilestones(...params: [MilestoneKey[]] | [TestHooks, MilestoneKey[]]): void {
  let milestones: MilestoneCoordinator;
  let keys: MilestoneKey[];
  let hooks: TestHooks;

  if (params.length === 1) {
    // @ts-ignore
    hooks = { beforeEach, afterEach };
    keys = params[0];
  } else {
    hooks = params[0];
    keys = params[1];
  }

  hooks.beforeEach(function() {
    milestones = activateMilestones(keys);
  });

  hooks.afterEach(function() {
    milestones.deactivateAll();
  });
}

/** @hide */
interface TestHooks {
  beforeEach(f: () => void): void;
  afterEach(f: () => void): void;
}