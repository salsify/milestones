import { MilestoneKey, MilestoneCoordinator as CoordinatorInterface } from '../index';
import { defer, assert, Deferred } from './sys';
import { getOrInit } from './global';
import MilestoneHandle from './milestone-handle';
import MilestoneTarget from './milestone-target';

/** @hide */
export const ACTIVE_COORDINATORS: Record<string, MilestoneCoordinator> = getOrInit('activeCoordinators', () =>
  Object.create(null),
);

/** @hide */
export default class MilestoneCoordinator implements CoordinatorInterface {
  public static forMilestone(name: MilestoneKey): MilestoneCoordinator | undefined {
    return ACTIVE_COORDINATORS[indexableKey(name)];
  }

  public static deactivateAll(): void {
    for (let key of allKeys(ACTIVE_COORDINATORS)) {
      let coordinator = this.forMilestone(key);
      if (coordinator) {
        coordinator.deactivateAll();
      }
    }
  }

  public names: MilestoneKey[];

  private _nextTarget: MilestoneTarget | null;
  private _pausedMilestone: MilestoneHandle | null;
  private _pendingActions: {
    [key: string]: { action: () => unknown; deferred: Deferred<unknown> };
  };

  public constructor(names: MilestoneKey[]) {
    names.forEach(name => {
      assert(!MilestoneCoordinator.forMilestone(name), `Milestone '${name.toString()}' is already active.`);
      ACTIVE_COORDINATORS[indexableKey(name)] = this;
    });

    this.names = names;
    this._pendingActions = Object.create(null);
    this._nextTarget = null;
    this._pausedMilestone = null;
  }

  public advanceTo(name: MilestoneKey): MilestoneTarget {
    assert(this.names.indexOf(name) !== -1, `Milestone '${name.toString()}' is not active.`);
    let target = new MilestoneTarget(name);

    this._nextTarget = target;
    this._continueAll({ except: name });

    let pending = this._pendingActions[indexableKey(name)];
    if (pending) {
      delete this._pendingActions[indexableKey(name)];
      this._targetReached(target, pending.deferred, pending.action);
    }

    return target;
  }

  public deactivateAll(): void {
    this._continueAll();

    this.names.forEach(name => {
      delete ACTIVE_COORDINATORS[indexableKey(name)];
    });

    this.names = [];
  }

  // Called from milestone()
  public _milestoneReached<T extends PromiseLike<unknown>>(name: MilestoneKey, action: () => T): T {
    let target = this._nextTarget;

    // If we're already targeting another milestone, just pass through
    if (target && target.name !== name) {
      return action();
    }

    let deferred = defer();
    if (target && target.name === name) {
      this._targetReached(target, deferred, action);
    } else {
      assert(!this._pendingActions[indexableKey(name)], `Milestone '${name.toString()}' is already pending.`);
      this._pendingActions[indexableKey(name)] = { deferred, action };
    }

    // Playing fast and loose with our casting here under the assumption that
    // `MilestoneHandler` will be well-behaved and not stub unexpected return types.
    return (deferred.promise as unknown) as T;
  }

  // Called by MilestoneHandle instances
  public _milestoneCompleted(milestone: MilestoneHandle): void {
    if (this._pausedMilestone === milestone) {
      this._pausedMilestone = null;
    }
  }

  private _targetReached(target: MilestoneTarget, deferred: Deferred<unknown>, action: () => unknown): void {
    this._nextTarget = null;
    this._pausedMilestone = new MilestoneHandle(target.name, this, action, deferred);

    target._resolve(this._pausedMilestone);
  }

  private _continueAll({ except }: { except?: MilestoneKey } = {}): void {
    let paused = this._pausedMilestone;
    if (paused && paused.name !== except) {
      paused.continue();
    }

    allKeys(this._pendingActions).forEach(key => {
      if (key === except) {
        return;
      }

      let { deferred, action } = this._pendingActions[indexableKey(key)];
      deferred.resolve(action());
      delete this._pendingActions[indexableKey(key)];
    });
  }
}

// TypeScript doesn't allow symbols as an index type, which makes a number of things
// in this module painful :( https://github.com/Microsoft/TypeScript/issues/1863
function indexableKey(key: MilestoneKey): string {
  return key as string;
}

function allKeys(object: unknown): MilestoneKey[] {
  let keys: MilestoneKey[] = Object.getOwnPropertyNames(object);
  if (typeof Object.getOwnPropertySymbols === 'function') {
    keys = keys.concat(Object.getOwnPropertySymbols(object));
  }
  return keys;
}
