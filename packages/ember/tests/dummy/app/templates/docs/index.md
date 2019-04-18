# Milestones

Milestones are a tool for annotating points in time in your code.

A milestone can act as a named synchronization point, allowing you to ensure the state of your application code at the moment in time in your testing when you wish to make assertions. They also give you the ability to change the behavior of annotated code during testing, skipping pauses or mocking out results.

## Hello, World

The following is a simple example of using a milestone to mark a single point in time. You can click `Play` to watch the full example play out, or click `Step` to move through the code line by line.

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

## Annotating Blocks of Code

In addition to marking a single point, milestones can annotate an asynchronous block of code. In addition to temporally locating yourself before or after that block, this allows you to change its behavior during testing.

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

To enable a set of milestones, call `activateMilestones()` with an array of milestone IDs. When an active milestone is reached, the promise it returns won't resolve until a corresponding `advanceTo()` call has been made. This is what enables you to synchronize between your test and application code.

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

  // Because this milestone isn't activated,
  // the code immediately continues.
  await milestone('hello-world');

  log('After');
  ```
  </pg.editor>
</MilestonesPlayground>

If you click the {{fa-icon 'cog'}} icon in the example above and then check the *Show Preamble Code* option, you'll be able to see a commented-out call to `activateMilestones()`. If you un-comment this line and run the example again, you'll see that it pauses at the milestone and never continues, because no `advanceTo()` call was made.

**Note**: the milestones on this page have used strings as identifiers, but in most other examples in this documentation you'll see we use symbols instead. In these cases, you'll find the symbol definition up in the Preamble block along with any other setup code.
