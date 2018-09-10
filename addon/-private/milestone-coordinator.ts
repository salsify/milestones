import { assert } from '@ember/debug';
import { CancelableDeferred, MilestoneKey } from 'ember-milestones';
import { MilestoneCoordinator as IMilestoneCoordinator } from 'ember-milestones';
import { defer } from './defer';
import MilestoneHandle from './milestone-handle';
import MilestoneTarget from './milestone-target';

/** @hide */
export const ACTIVE_COORDINATORS: {
  // TypeScript doesn't allow symbols as an index type, which makes a number of things
  // in this module painful :( https://github.com/Microsoft/TypeScript/issues/1863
  [key: string]: MilestoneCoordinator;
} = Object.create(null);

/** @hide */
export default class MilestoneCoordinator implements IMilestoneCoordinator {
  public static forMilestone(name: MilestoneKey): MilestoneCoordinator | undefined {
    return ACTIVE_COORDINATORS[name as any];
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

  private _pendingActions: { [key: string]: { action: () => any, deferred: CancelableDeferred } };
  private _nextTarget: MilestoneTarget | null;
  private _pausedMilestone: MilestoneHandle | null;

  constructor(names: MilestoneKey[]) {
    names.forEach((name) => {
      assert(`Milestone '${name.toString()}' is already active.`, !MilestoneCoordinator.forMilestone(name));
      ACTIVE_COORDINATORS[name as any] = this;
    });

    this.names = names;
    this._pendingActions = Object.create(null);
    this._nextTarget = null;
    this._pausedMilestone = null;
  }

  public advanceTo(name: MilestoneKey): MilestoneTarget {
    assert(`Milestone '${name.toString()}' is not active.`, this.names.indexOf(name) !== -1);
    let target = new MilestoneTarget(name);

    this._nextTarget = target;
    this._continueAll({ except: name });

    let pending = this._pendingActions[name as any];
    if (pending) {
      delete this._pendingActions[name as any];
      this._targetReached(target, pending.deferred, pending.action);
    }

    return target;
  }

  public deactivateAll() {
    this._continueAll();

    this.names.forEach((name) => {
      delete ACTIVE_COORDINATORS[name as any];
    });

    this.names = [];
  }

  // Called from milestone()
  public _milestoneReached<T extends PromiseLike<any>>(name: MilestoneKey, action: () => T): T {
    let target = this._nextTarget;

    // If we're already targeting another milestone, just pass through
    if (target && target.name !== name) {
      return action();
    }

    let deferred = defer();
    if (target && target.name === name) {
      this._targetReached(target, deferred, action);
    } else {
      assert(`Milestone '${name.toString()}' is already pending.`, !this._pendingActions[name as any]);
      this._pendingActions[name as any] = { deferred, action };
    }

    // Playing fast and loose with our casting here under the assumption that
    // `MilestoneHandler` will be well-behaved and not stub unexpected return types.
    return deferred.promise as any as T;
  }

  // Called by MilestoneHandle instances
  public _milestoneCompleted(milestone: MilestoneHandle) {
    if (this._pausedMilestone === milestone) {
      this._pausedMilestone = null;
    }
  }

  private _targetReached(target: MilestoneTarget, deferred: CancelableDeferred, action: () => any) {
    this._nextTarget = null;
    this._pausedMilestone = new MilestoneHandle(target.name, this, action, deferred);

    target._resolve(this._pausedMilestone);
  }

  private _continueAll({ except }: { except?: MilestoneKey } = {}) {
    let paused = this._pausedMilestone;
    if (paused && paused.name !== except) {
      paused.continue();
    }

    allKeys(this._pendingActions).forEach((key) => {
      if (key === except) { return; }

      let { deferred, action } = this._pendingActions[key as any];
      deferred.resolve(action());
      delete this._pendingActions[key as any];
    });
  }
}

function allKeys(object: any) {
  let keys: MilestoneKey[] = Object.getOwnPropertyNames(object);
  if (typeof Object.getOwnPropertySymbols === 'function') {
    keys = keys.concat(Object.getOwnPropertySymbols(object));
  }
  return keys;
}
