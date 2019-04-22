# Milestones

Milestones are a tool for annotating points in time in your code.

A milestone acts as a named synchronization point, allowing you to precisely know the state of your application code at the moment in time when you want to make assertions in a test. They also give you the ability to change the behavior of annotated code during testing, skipping pauses or mocking out results.

## Motivation

The use of milestones is easiest to explain with a motivating example, examining the pitfalls of the scenario and how milestones provide a means of dealing with them.

### The Problem

Suppose you have a flow where the user clicks a button to save some changes they've made, and you want to keep them apprised of progress as this happens by displaying status messages.

```ts
displayMessage('Saving...');
await saveData();

displayMessage('Saved!');
await sleep(3000);

displayMessage('');
```

To test this flow and ensure you're showing the right message in the right circumstances, you need to watch for the moments in time when state has changed and you can make assertions against the visible result. Supposing you have a helper to poll until a condition comes true, you might write something like:

```ts
click('.the-save-button');
await pollUntilTrue(() => currentMessage() !== '');

expect(currentMessage()).to.equal('Saving...');
await pollUntilTrue(() => currentMessage() !== 'Saving...');

expect(currentMessage()).to.equal('Saved!');
await pollUntilTrue(() => currentMessage() !== 'Saved!');

expect(currentMessage()).to.equal('');
```

While this test will guarantee that you run through the right sequence of messages, the polling approach has a couple of fairly unsatisfying shortcomings.
 - **This test will take more than three seconds to run**, because it has to stop and wait for the `'Saved!'` message to clear. While adding three seconds to your test suite may not seem like the end of the world one time, this sort of delay quickly adds up, hurting your ability to get quick feedback from your tests.
 - More insidiously, **there's a subtle race condition**. Since you're relying on polling to determine when it's time to proceed in the test, small changes in the timing of your application code may cause your tests to break. Depending on how often `pollUntilTrue` checks its condition and how quickly `saveData` runs, your test might never see the `'Saving...'` message, causing it to sometimes pass and sometimes fail.

### A Solution

By annotating key pieces of asynchronous code with milestones, you can eliminate the polling in your test and move quickly and accurately between specific points of interest to make assertions.

The following example shows the code from above using milestones to drive the flow of the test. If you'd rather start with a simpler example, you can skip to **Points in Time** below and come back to this when you're more comfortable with the basic moving parts.

Click `Play` to watch the full example play out, or click `Step` to move through the code line by line.

<MilestonesPlayground @showDOM={{true}} @lines={{15}} as |playground|>
  <playground.preamble>
  ```ts
  import { milestone, advanceTo, activateMilestones } from '@milestones/core';
  import { element } from '@milestones/playground';
  import { expect } from 'chai';

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const saveData = () => sleep(250);

  const displayMessage = msg => element.innerText = msg;
  const currentMessage = () => element.innerText;

  const Save = Symbol('save');
  const ShowMessage = Symbol('show-message');

  activateMilestones([Save, ShowMessage]);
  ```
  </playground.preamble>

  <playground.editor @title="Test Code">
  ```ts
  // Wait until we start saving, then check that
  // the appropriate message is being shown
  let saveHandle = await advanceTo(Save);
  expect(currentMessage()).to.equal('Saving...');

  // Now go ahead and perform the save
  await saveHandle.continue();
  expect(currentMessage()).to.equal('Saved!');

  // Now advance to where we pause to show the
  // 'Saved!' message, but immediately return
  await advanceTo(ShowMessage).andReturn();
  expect(currentMessage()).to.equal('');
  ```
  </playground.editor>

  <playground.editor @title="Application Code">
  ```ts
  displayMessage('Saving...');
  await milestone(Save, () => saveData());

  displayMessage('Saved!');
  await milestone(ShowMessage, () => sleep(3000));

  displayMessage('');
  ```
  </playground.editor>
</MilestonesPlayground>


## Points in Time

Milestones can mark single points, drawing a line in the sand and dividing a flow cleanly into everything that comes _before_ versus everything that comes _after._
To proceed up to this point, you call `advanceTo()` in your test and await the resulting promise.

Once it's resolved, that means you've paused the world at that moment in time and can inspect any state and make assertions to your heart's content. When you're ready, you can start the flow of time back up again and allow the code under test to continue.

<MilestonesPlayground @lines={{12}} as |pg|>
  <pg.preamble>
  ```ts
  import { milestone, advanceTo, activateMilestones } from '@milestones/core';
  import { log } from '@milestones/playground';

  activateMilestones(['hello-world']);
  ```
  </pg.preamble>

  <pg.editor @title="Test Code">
  ```ts
  // This will pause until the code annotated w/
  // the 'hello-world' milestone has been reached
  let handle = await advanceTo('hello-world');

  // At this point, you know all code before the
  // milestone has executed, and none of the code
  // after it.
  log('Paused');

  // Calling 'continue()' will resume execution
  handle.continue();
  ```
  </pg.editor>

  <pg.editor @title="Application Code">
  ```ts
  log('Before');

  // This will pause until the test code
  // releases this milestone.
  await milestone('hello-world');

  log('After');
  ```
  </pg.editor>
</MilestonesPlayground>

## Windows of Time

In addition to marking a single point, milestones can annotate an asynchronous block of code. As with point-in-time milestones, this gives you the ability to temporally locate yourself before or after the window represented by that block, but it also allows you to change its behavior during testing.

<MilestonesPlayground as |pg|>
  <pg.preamble>
  ```ts
  import { milestone, advanceTo, activateMilestones } from '@milestones/core';
  import { log } from '@milestones/playground';

  activateMilestones(['msg']);
  ```
  </pg.preamble>

  <pg.editor @title='Test Code'>
  ```ts
  let handle = await advanceTo('msg');

  handle.return('Skipped');
  ```
  </pg.editor>

  <pg.editor @title='Application Code'>
  ```ts
  let url = 'https://httpbin.org/get?msg=Hello';
  let msg = await milestone('msg', async () => {
    let response = await fetch(url);
    let json = await response.json();
    return json.args.msg;
  });

  log(msg);
  ```
  </pg.editor>
</MilestonesPlayground>

For more details, see the {{#link-to 'docs.interacting-with-milestones'}}Interacting with Milestones{{/link-to}} section of the docs.


## Activating Milestones

By default, milestones are totally inert. Any inactive milestone will immediately resolve to the return value of its given callback (or `undefined` if it doesn't have one).

To enable a set of milestones, call `activateMilestones()` with an array of milestone keys. When an active milestone is reached, the promise it returns won't resolve until a corresponding `advanceTo()` call has been made. This is what enables you to synchronize between your test and application code.

<MilestonesPlayground as |pg|>
  <pg.preamble>
  ```ts
  import { milestone, activateMilestones } from '@milestones/core';
  import { log } from '@milestones/playground';

  // If you uncomment the following line, the code below will pause
  // indefinitely when the 'hello-world' milestone is reached.

  // activateMilestones(['hello-world']);
  ```
  </pg.preamble>

  <pg.editor @title='Application Code'>
  ```ts
  log('Before');

  // Because this milestone isn't activated, the code immediately continues.
  await milestone('hello-world');

  log('After');
  ```
  </pg.editor>
</MilestonesPlayground>

If you click the {{fa-icon 'cog'}} icon in the example above and then check the *Show Preamble Code* option, you'll be able to see a commented-out call to `activateMilestones()`. If you un-comment this line and run the example again, you'll see that it pauses at the milestone and never continues, because no `advanceTo()` call was made.

**Note**: some of the milestones on this page have used strings as identifiers, but in most other examples in this documentation you'll see we use symbols instead. In these cases, you'll find the symbol definition up in the Preamble block along with any other setup code.

## Debugging Milestones

The `@milestones/core` package uses [visionmedia/debug](https://github.com/visionmedia/debug) to log details when a milestone is reached or `advanceTo` is called. If you find yourself working on a test with milestones and uncertain why a promise isn't (or is) resolving, you may find this information helpful.

In Node, you can enable debug output by setting the `DEBUG` environment variable to match all messages whose namespace begins with `@milestones/`:

```sh
DEBUG='@milestones/*' node my/test/entry-point.js
```

In the browser, you can set the `debug` key in local storage the same way (you'll likely need to refresh the page afterwards for it to take effect):

```js
localStorage.debug = '@milestones/*';
```
