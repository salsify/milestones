# Ember

The `@milestones/ember` addon integrates with the Ember runtime and ember-cli to provide zero-config setup for working with milestones.

## Runtime

All milestones are configured by `@milestones/ember` to use RSVP for their promise implementation, ensuring that any code that executes as a result of a milestone occurs within a runloop.

## Build

By default, milestones will be stripped from your code in production builds using `@milestones/babel-plugin-strip-milestones`. This behavior is always controlled by the host application, and it can be overridden in the host's `ember-cli-build.js`.

```ts
let app = new EmberApp(defaults, {
  milestones: {
    stripMilestones: false, // or whatever your preference
  },
});
```

## Ember Concurrency

If `ember-concurrency` is present in your project, any milestones you create will be task-like promises that will bubble cancelation appropriately. They will also be cancelable from your test code

<MilestonesPlayground @showPreamble={{true}} as |pg|>
  <pg.preamble>
  ```ts
  import { milestone, advanceTo, activateMilestones } from '@milestones/core';
  import { log } from '@milestones/playground';
  import { didCancel } from 'ember-concurrency';

  const MyTask = Symbol('task');

  activateMilestones([MyTask]);
  ```
  </pg.preamble>

  <pg.editor @title='Test Code'>
  ```ts
  await advanceTo(MyTask).andCancel();
  ```
  </pg.editor>

  <pg.editor @title='Application Code'>
  ```ts
  try {
    await milestone(MyTask, () => {
      return this.task.perform()
    });
  } catch (error) {
    if (!didCancel(error)) throw error;

    log('Task was canceled');
  }
  ```
  </pg.editor>
</MilestonesPlayground>
