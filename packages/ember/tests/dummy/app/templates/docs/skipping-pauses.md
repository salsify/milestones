# Skipping Pauses

Often in application code you may pause for a fixed amount of time, maybe for UX reasons as part of a user flow, or maybe to take a moment between checks on the status of a long running operation.

These kinds of pauses make for dead air in your tests: wasted time when nothing meaningful is being accomplished, only serving to increase the overall runtime of your test suite.

## Skipping by Hand

Skipping a pause by hand is fairly straightforward:
 - wrap the pause in a milestone
 - activate that milestone for any tests that would hit the pause
 - advance to the pause at the point in your test where you'd hit it
 - call `return()` rather than `continue()` so that the pause is skipped

While this is conceptually straightforward to do, in practice it gets tedious very quickly, and it has the potential to be brittle as you refactor code or add other pauses in your code.

## Skipping Automatically

Fortunately, the milestones API offers the tools you need to abstract away the tedious parts of activating and skipping pause milestones.

First, create a symbol that all your pause milestones will share as a tag:

```ts
const Pause = Symbol('pause');
```

Then, write a function called `pause` (or whatever you like) that returns a milestone with that tag that will resolve after the given amount of time has passed:

```ts
export function pause(ms, milestoneId = Symbol()) {
  return milestone(
    milestoneId,
    () => new Promise(resolve => setTimeout(resolve, ms)),
    { tags: [Pause] }
  );
}
```

Finally, add a function you can call in your test suite that will cause all milestones with that tag to immediately return:

```ts
export function skipAllPauses() {
  let coordinator;

  beforeEach(() => {
    coordinator = activateMilestones([Pause], {
      onMilestoneReached: milestone => milestone.return()
    });
  });

  afterEach(() => {
    coordinator.deactivateAll();
  });
}
```

Now you can use `await pause(duration)` in your application code anywhere you need to idle for some amount of time, and call `skipAllPauses()` as part of your setup for tests where you don't want to wait.

Note also that `pause` allows you to provide an optional ID for the milestone so that you can skip all timeouts during a test by default, but still be able to reference that particular milestone and advance to it when necessary.
