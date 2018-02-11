import CoordinatorImpl from 'ember-milestones/-private/milestone-coordinator';
import {
  MilestoneCoordinator,
  MilestoneTarget,
  MilestoneTestOptions,
  TestHooks,
} from 'ember-milestones/interfaces';

export * from 'ember-milestones/interfaces';

import logger from 'debug';

const debugActive = logger('ember-milestones:active');
const debugInactive = logger('ember-milestones:inactive');

/**
 * Activate all milestones in the given array of names. Active milestones will pause
 * when they are reached until instructed on how to proceed via a `MilestoneHandle`.
 *
 * Inactive milestones will pass through to their given callbacks as though the
 * milestone wrapper weren't present at all.
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
export function milestone<T extends PromiseLike<any>>(name: string, callback: () => T): T {
  let coordinator = CoordinatorImpl.forMilestone(name);
  if (coordinator) {
    debugActive('reached active milestone %s', name);
    return coordinator._milestoneReached(name, callback);
  } else {
    debugInactive('skipping inactive milestone %s', name);
    return callback();
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
