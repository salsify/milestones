# Milestone Keys

Milestones are identified by _keys,_ values that are either strings or symbols that allow you to refer to them when using things like `activateMilestones` and `advanceTo`. A milestone may be identified by one or more keys: a single unique ID, and any number of optional tags.

## Milestone IDs

Every milestone must have a unique _ID_ — this is the first argument you pass when you call `milestone()`. At any given time, there may only ever be at most one paused milestone with a particular ID.

If a milestone is reached when another with the same ID is already paused, the second milestone will immediately reject with an error. This behavior helps keep your tests deterministic by default and avoid accidental concurrency when you don't want it.

## Milestone Tags

What if you actually do want to refer to two or more milestones interchangeably? For this, you can use _tags_. Unlike IDs, tags may be shared across as many milestones as you like. You can use tags to identify a group of milestones by some common characteristic of their behavior, like `"timeout"`.

You can also use tags to allow your code to be paused at the same milestone more than once. The example below generates a fresh anonymous symbol as the milestone's ID each time it's reached, relying on its tag as the way to activate and advance to it.

<MilestonesPlayground as |pg|>
  <pg.preamble>
  ```ts
  import { milestone, advanceTo, activateMilestones } from '@milestones/core';
  import { log } from '@milestones/playground';

  activateMilestones(['foo-tag']);
  ```
  </pg.preamble>

  <pg.editor @title="Test Code">
  ```ts
  let go = () => milestone(Symbol(), {
    tags: ['foo-tag']
  });

  await Promise.all([go(), go(), go()]);

  log('All resolved');
  ```
  </pg.editor>

  <pg.editor @title="Application Code">
  ```ts
  for (let i of [1, 2, 3]) {
    log('Advancing', i);

    await advanceTo('foo-tag').andContinue();
  }

  log('Done');
  ```
  </pg.editor>
</MilestonesPlayground>
