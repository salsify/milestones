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
  public static forKey(key: MilestoneKey): MilestoneCoordinator | undefined {
    return ACTIVE_COORDINATORS[indexableKey(key)];
  }

  public static forMilestone(id: MilestoneKey, tags: MilestoneKey[]): MilestoneCoordinator | undefined {
    let keys = [id].concat(tags);
    for (let key of keys) {
      let coordinator = this.forKey(key);
      if (coordinator) {
        return coordinator;
      }
    }
    return undefined;
  }

  public static deactivateAll(): void {
    for (let key of allKeys(ACTIVE_COORDINATORS)) {
      let coordinator = this.forKey(key);
      if (coordinator) {
        coordinator.deactivateAll();
      }
    }
  }

  public keys: MilestoneKey[];

  private _nextTarget: MilestoneTarget | null;
  private _pausedMilestone: MilestoneHandle | null;
  private _pendingActions: Record<MilestoneKey, PendingAction>;

  public constructor(keys: MilestoneKey[]) {
    keys.forEach(key => {
      assert(!MilestoneCoordinator.forKey(key), `Milestone '${key.toString()}' is already active.`);
      ACTIVE_COORDINATORS[indexableKey(key)] = this;
    });

    this.keys = keys;
    this._pendingActions = Object.create(null);
    this._nextTarget = null;
    this._pausedMilestone = null;
  }

  public advanceTo(key: MilestoneKey): MilestoneTarget {
    assert(this.keys.indexOf(key) !== -1, `Milestone '${key.toString()}' is not active.`);
    assert(!this._nextTarget, `Already attempting to advance to ${this._nextTarget} in this coordinator.`);

    let target = new MilestoneTarget(key);
    this._nextTarget = target;
    this._continueAll({ except: key });

    let pending = this._getPendingAction(key);
    if (pending) {
      delete this._pendingActions[indexableKey(pending.id)];
      this._targetReached(target, pending.id, pending.tags, pending.deferred, pending.action);
    }

    return target;
  }

  public deactivateAll(): void {
    this._continueAll();

    this.keys.forEach(key => {
      delete ACTIVE_COORDINATORS[indexableKey(key)];
    });

    this.keys = [];
  }

  // Called from milestone()
  public _milestoneReached<T extends PromiseLike<unknown>>(id: MilestoneKey, tags: MilestoneKey[], action: () => T): T {
    let target = this._nextTarget;

    // If we're already targeting another milestone, just pass through
    if (target && !matchesKey(target.key, id, tags)) {
      return action();
    }

    let deferred = defer();
    if (target && matchesKey(target.key, id, tags)) {
      this._targetReached(target, id, tags, deferred, action);
    } else {
      assert(!this._pendingActions[indexableKey(id)], `Milestone '${id.toString()}' is already pending.`);
      this._pendingActions[indexableKey(id)] = { id: id, tags, deferred, action };
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

  private _targetReached(
    target: MilestoneTarget,
    id: MilestoneKey,
    tags: MilestoneKey[],
    deferred: Deferred<unknown>,
    action: () => unknown,
  ): void {
    this._nextTarget = null;
    this._pausedMilestone = new MilestoneHandle(id, tags, this, action, deferred);

    target._resolve(this._pausedMilestone);
  }

  private _continueAll({ except }: { except?: MilestoneKey } = {}): void {
    let paused = this._pausedMilestone;
    if (paused && !matchesKey(except, paused.id, paused.tags)) {
      paused.continue();
    }

    allKeys(this._pendingActions).forEach(key => {
      let { id, deferred, action, tags } = this._pendingActions[indexableKey(key)];
      if (matchesKey(except, id, tags)) {
        return;
      }

      deferred.resolve(action());
      delete this._pendingActions[indexableKey(key)];
    });
  }

  private _getPendingAction(key: MilestoneKey): PendingAction | undefined {
    let id = allKeys(this._pendingActions).find(maybeId => {
      let { tags } = this._pendingActions[indexableKey(maybeId)];
      return matchesKey(key, maybeId, tags);
    });

    return id ? this._pendingActions[indexableKey(id)] : undefined;
  }
}

interface PendingAction {
  id: MilestoneKey;
  tags: MilestoneKey[];
  action: () => unknown;
  deferred: Deferred<unknown>;
}

function matchesKey(key: MilestoneKey | undefined, id: MilestoneKey, tags: MilestoneKey[]): boolean {
  return key !== undefined && (key === id || tags.indexOf(key) !== -1);
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
