# Interacting with Milestones

Once one or more milestones are marked in your code, you can reference them from your tests to synchronize the flow of control between them and the code under inspection.

## Activating Milestones

Before interacting with milestones, they must first be activated.

```ts
import { activateMilestones } from '@milestones/core';
import { MilestoneA, MilestoneB } from 'my/module/under/test';

activateMilestones([MilestoneA, MilestoneB]);
```

Inactive milestones behave as if the annotation weren't there at all. For instance, if `MilestoneC` and `MilestoneD` haven't been activated, then the following two blocks will behave identically:

```ts
let x = await milestone(MilestoneC);
let y = await milestone(MilestoneD, () => doSomethingAsyncronous());
```

```ts
let x = await undefined;
let y = await doSomethingAsynchronous();
```

With {{#link-to 'docs.babel-plugin'}}`@milestones/babel-plugin`{{/link-to}}, you can strip milestones out of your production code entirely to avoid even the overhead of the `milestone()` function call.


## Advancing to a Milestone

To pause your test code until a particular milestone has been reached, await the promise returned by `advanceTo()`.

```ts
import { advanceTo } from '@milestones/core';
import { MilestoneA } from 'my/module/under/test';

// ...
// Other imports, setup and test assertions
// ...

await advanceTo(MilestoneA);

// At this point, the code marked with `MilestoneA` has been reached
// but not yet begun to execute.
```

By default, when an active milestone is reached, it will pause until your test code advances to it and determines how it should proceed. However, if multiple milestones are activated together and one is reached while in the process of advancing to another, it will proceed as though it were inactive, avoiding deadlock in your test.

<MilestonesPlayground @lines={{6}} as |pg|>
  <pg.preamble>
  ```ts
  import { milestone, advanceTo, activateMilestones } from '@milestones/core';
  import { log } from '@milestones/playground';

  const MilestoneA = Symbol('a');
  const MilestoneB = Symbol('b');

  activateMilestones([MilestoneA, MilestoneB]);
  ```
  </pg.preamble>

  <pg.editor @title="Test Code">
  ```ts
  let handle = await advanceTo(MilestoneB);

  log('Reached MilestoneB');

  await handle.return();
  ```
  </pg.editor>

  <pg.editor @title="Application Code">
  ```ts
  await milestone(MilestoneA);

  await milestone(MilestoneB);
  ```
  </pg.editor>
</MilestonesPlayground>

See the section on {{#link-to 'docs.coordination'}}Coordination{{/link-to}} for more details on how milestones activated together and separately interact with one another.

## Proceeding from a Milestone

When you `advanceTo` an active milestone in a test, the application code will pause at that milestone, allowing you to make assertions about current state. The promise returned by `advanceTo` will resolve to a _milestone handle_, which is an object with several methods on it that allow you to dictate how the milestone will behave when it resumes.

### `continue()`

The most direct option for proceeding from a paused milestone is to `continue`. This will cause it to pick up where it left off, invoking its callback and ultimately returning the same value.

When you call `continue`, it returns a promise that resolves when the result of the callback has settled, so when your test code resumes after a continue, you can be certain that the corresponding callback has finished executing.

<MilestonesPlayground as |pg|>
  <pg.preamble>
  ```ts
  import { milestone, advanceTo, activateMilestones } from '@milestones/core';
  import { log } from '@milestones/playground';

  const M1 = Symbol('milestone-1');

  activateMilestones([M1]);
  ```
  </pg.preamble>

  <pg.editor @title="Test Code">
  ```ts
  let handle = await advanceTo(M1);

  log('Reached M1');

  await handle.continue();

  log('Completed M1');
  ```
  </pg.editor>

  <pg.editor @title="Application Code">
  ```ts
  let url = 'https://httpbin.org/get?msg=Hello';
  let msg = await milestone(M1, async () => {
    let response = await fetch(url);
    let json = await response.json();
    return json.args.msg;
  });

  log(msg);
  ```
  </pg.editor>
</MilestonesPlayground>

### `return(value)`

Alternatively, you may choose to return a value from a resolved milestone. This allows you to skip its callback entirely and instead dictate the return value directly, which may be useful if you'd like to stub an interaction with an external service or just skip a long timeout to speed up your test.

<MilestonesPlayground as |pg|>
  <pg.preamble>
  ```ts
  import { milestone, advanceTo, activateMilestones } from '@milestones/core';
  import { log } from '@milestones/playground';

  const M1 = Symbol('milestone-1');

  activateMilestones([M1]);
  ```
  </pg.preamble>

  <pg.editor @title="Test Code">
  ```ts
  let handle = await advanceTo(M1);

  log('Reached M1');

  await handle.return('Stubbed');

  log('Completed M1');
  ```
  </pg.editor>

  <pg.editor @title="Application Code">
  ```ts
  let url = 'https://httpbin.org/get?msg=Hello';
  let msg = await milestone(M1, async () => {
    let response = await fetch(url);
    let json = await response.json();
    return json.args.msg;
  });

  log(msg);
  ```
  </pg.editor>
</MilestonesPlayground>

### `throw(error)`

You can also cause the milestone's promise to reject rather than resolve, throwing an error to ensure your code handles failure scenarios as expected.

<MilestonesPlayground as |pg|>
  <pg.preamble>
  ```ts
  import { milestone, advanceTo, activateMilestones } from '@milestones/core';
  import { log } from '@milestones/playground';

  const M1 = Symbol('milestone-1');

  activateMilestones([M1]);
  ```
  </pg.preamble>

  <pg.editor @title="Test Code">
  ```ts
  let handle = await advanceTo(M1);

  log('Reached M1');

  await handle.throw(new Error('💥'));

  log('Completed M1');
  ```
  </pg.editor>

  <pg.editor @title="Application Code">
  ```ts
  let url = 'https://httpbin.org/get?msg=Hello';
  try {
    await milestone(M1, async () => {
      let response = await fetch(url);
      let json = await response.json();
      return json.args.msg;
    });
  } catch (error) {
    log('Error:', error);
  }
  ```
  </pg.editor>
</MilestonesPlayground>

### `cancel()`

If your underlying system supports it, you may also choose to cancel your milestone. The details of what exactly this means are implementation-specific, but as an example, calling `cancel` with `@milestones/ember` causes the milestone in question to behave as a cancelled `ember-concurrency` task.

## Shorthand

The return value of an `advanceTo` call also has shorthand methods on it corresponding to each of the four actions above, which you can use if you don't need to stop and do anything when a milestone is first reached.

That is, the following two code blocks are equivalent:

```ts
let handle = await advanceTo(Milestone);
await handle.continue();
```

```ts
await advanceTo(Milestone).andContinue();
```

And similarly for each of:

```ts
await advanceTo(Milestone).andReturn(123);
await advanceTo(Milestone).andThrow(new Error('boom'));
await advanceTo(Milestone).andCancel();
```
