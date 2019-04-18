# Deactivating Milestones

Since milestones allow you to completely cross-cut the normal architectural structure of your app for the purposes of testing, hygiene is important. Leaking active milestones between tests can lead to strange behaviors and hung test runs. Fortunately, it's easy to clean up after yourself.

## Explicit Deactivation

The simplest way to turn off milestones is to call `deactivateAllMilestones()` from `@milestones/core`. All paused milestones will immediately `continue()`, and every active milestone will deactivate, returning your application code back to its normal behavior.

```ts
import { activateMilestones, deactivateAllMilestones } from '@milestones/core';
import { A, B, C } from 'something/under/test';

describe('something under test', () => {
  beforeEach(() => {
    activateMilestones([A, B, C]);
  });

  afterEach(() => {
    deactivateAllMilestones();
  });

  // Your tests cases here
});
```

Milestone coordinators also have a `deactivateAll()` method that deactivates _only_ the milestones belonging to that coordinator.

## Automatic Setup/Teardown

A very common pattern you'll see is the one in the snippet above, where you activate some milestones in a `beforeEach` and then deactivate them (either individually or in bulk) in an `afterEach`. In fact, this pattern is so common that `@milestones/core` has a built in utility for it.

If you use a testing library like Jest or Mocha that has uses global `beforeEach` and `afterEach` hooks, you can call `setupMilestones` to automatically enable a set of keys before your tests and disable them afterwards.

```ts
import { setupMilestones } from '@milestones/core';
import { A, B, C } from 'something/under/test';

describe('something under test', () => {
  setupMilestones([A, B, C]);

  // Your tests cases here
});
```

If you use a testinig library like QUnit that exposes `beforeEach` and `afterEach` on a hooks object instead, you can pass that as an initial argument to `setupMilestones`:

```ts
import { setupMilestones } from '@milestones/core';
import { A, B, C } from 'something/under/test';

module('something under test', (hooks) => {
  setupMilestones(hooks, [A, B, C]);

  // Your tests cases here
});
```
