import { assert } from '@ember/debug';
import { CancelableDeferred } from 'ember-milestones';
import { MilestoneCoordinator as IMilestoneCoordinator } from 'ember-milestones';
import { defer } from './defer';
import MilestoneHandle from './milestone-handle';
import MilestoneTarget from './milestone-target';

/** @hide */
export const ACTIVE_COORDINATORS: { [key: string]: MilestoneCoordinator } = Object.create(null);

/** @hide */
export default class MilestoneCoordinator implements IMilestoneCoordinator {
  public static forMilestone(name: string): MilestoneCoordinator | undefined {
    return ACTIVE_COORDINATORS[name];
  }

  public static deactivateAll(): void {
    let keys = Object.keys(ACTIVE_COORDINATORS);
    for (; keys.length; keys = Object.keys(ACTIVE_COORDINATORS)) {
      ACTIVE_COORDINATORS[keys[0]].deactivateAll();
    }
  }

  public names: string[];

  private _pendingActions: { [key: string]: { action: () => any, deferred: CancelableDeferred } };
  private _nextTarget: MilestoneTarget | null;
  private _pausedMilestone: MilestoneHandle | null;

  constructor(names: string[]) {
    names.forEach((name) => {
      assert(`Milestone '${name}' is already active.`, !ACTIVE_COORDINATORS[name]);
      ACTIVE_COORDINATORS[name] = this;
    });

    this.names = names;
    this._pendingActions = Object.create(null);
    this._nextTarget = null;
    this._pausedMilestone = null;
  }

  public advanceTo(name: string): MilestoneTarget {
    assert(`Milestone '${name}' is not active.`, this.names.indexOf(name) !== -1);
    let target = new MilestoneTarget(name);

    this._nextTarget = target;
    this._continueAll({ except: name });

    let pending = this._pendingActions[name];
    if (pending) {
      delete this._pendingActions[name];
      this._targetReached(target, pending.deferred, pending.action);
    }

    return target;
  }

  public deactivateAll() {
    this._continueAll();

    this.names.forEach((name) => {
      delete ACTIVE_COORDINATORS[name];
    });

    this.names = [];
  }

  // Called from milestone()
  public _milestoneReached<T extends PromiseLike<any>>(name: string, action: () => T): T {
    let target = this._nextTarget;

    // If we're already targeting another milestone, just pass through
    if (target && target.name !== name) {
      return action();
    }

    let deferred = defer();
    if (target && target.name === name) {
      this._targetReached(target, deferred, action);
    } else {
      assert(`Milestone '${name}' is already pending.`, !this._pendingActions[name]);
      this._pendingActions[name] = { deferred, action };
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

  private _continueAll({ except }: { except?: string } = {}) {
    let paused = this._pausedMilestone;
    if (paused && paused.name !== except) {
      paused.continue();
    }

    Object.keys(this._pendingActions).forEach((key) => {
      if (key === except) { return; }

      let { deferred, action } = this._pendingActions[key];
      deferred.resolve(action());
      delete this._pendingActions[key];
    });
  }
}
