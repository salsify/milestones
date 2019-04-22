# Ember

The `@milestones/ember` addon doesn't expand the API surface area of the library; in your application code and tests you'll import from `@milestones/core` like any other consumer. Instead, the purpose of the addon is to integrate with the Ember runtime and ember-cli to provide zero-config setup for working with milestones.

## Why Do I Need This?

You may wonder why milestones are necessary at all in an Ember project, given the excellent suite of tools at your disposal out of the box with `@ember/test-helpers`. Let's return to the motivating example from {{#link-to 'docs.index'}}the beginning of the docs{{/link-to}}:

```ts
displayMessage('Saving...');
await saveData();

displayMessage('Saved!');
await sleep(3000);

displayMessage('');
```

Because Ember's testing system has a baked in concept of when pending work is done and things are [`settled`](https://github.com/emberjs/ember-test-helpers/blob/master/API.md#settled), you might expect to be able to test this flow in a very natural way. However, you'll run into trouble right out of the gate:

```ts
await click('.the-save-button');
assert.dom('.the-message').hasText('Saving...');
```

Here, the `settled` abstraction has become a double-edged sword: the promise returned by `click` won't resolve until _all_ pending asynchronous actions are complete. This means that the save will be complete and the status messages will already have been shown and cleared before you could even make your first assertion.

You could instead use [`waitUntil`](https://github.com/emberjs/ember-test-helpers/blob/master/API.md#waituntil), which doesn't rely on `settled`, but this is exactly the same as the `pollUntilTrue` approach described in the original example, and it has the same shortcomings. There are times when you need finer-grained control of asynchrony than you have with `@ember/test-helpers`, and that's when milestones are useful.

## Runtime Integration

All milestones are configured by `@milestones/ember` to use RSVP for their promise implementation, and any code that executes as a result of a milestone is guaranteed to occur within a runloop.

## Build Integration

By default, milestones will be stripped from your code in production builds using `@milestones/babel-plugin-strip-milestones`. This behavior is always controlled by the host application, and it can be overridden in the host's `ember-cli-build.js`.

```ts
let app = new EmberApp(defaults, {
  milestones: {
    stripMilestones: false, // or whatever your preference
  },
});
```

## Ember Concurrency

If `ember-concurrency` is present in your project, any milestones you create will be task-like promises that will bubble cancelation appropriately. They will also be cancelable from your test code.

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
