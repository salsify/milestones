# Coordination

For many simple uses of milestones, the details of the coordination between them can be glossed over. If you're skimming these guides to get a high level overview of the library, you may even want to skip this section and come back when you find yourself needing more details.

However, if you're dealing with hairy concurrency situations with multiple different logical threads of execution under test, understanding how different sets of milestones interact is key to ensuring you have the degreee of control you need and that your tests are deterministic.

## Milestone Coordinators

Each time you call `activateMilestones`, it creates a {{#link-to 'docs.api.item' 'modules/@milestones/core~MilestoneCoordinator'}}`MilestoneCoordinator`{{/link-to}} instance.

When a milestone is reached, it checks to see if there's an active coordinator for either its ID or one of its tags. If so, it pauses until that coordinator tells it how to continue. When you call `advanceTo` with a milestone key, it locates the corresponding coordinator and waits until it's ready with the pending milestone, and then passes your instruction back to the paused milestone for how to proceed.

A given milestone coordinator can only be paused at or advancing to a single milestone at a time. As mentioned in {{#link-to 'docs.interacting-with-milestones'}}Interacting with Milestones{{/link-to}}, if you're currently advancing to a particular milestone, all others belonging to the same coordinator that are reached along the way will automatically behave as if you called `.continue()` on them. This prevents a deadlock scenario where your tests are waiting to reach one milestone, but your application code is waiting to hear how to proceed with an earlier one.

### Logical Threads of Execution

While it's possible to have true parallelism with tools like [web workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) in the browser or [worker threads](https://nodejs.org/api/worker_threads.html#worker_threads_worker_threads) in Node.js, most day-to-day usage of JavaScript is single-threaded. However, concurrent _logical_ threads of execution can easily coexist (or else there wouldn't be much point to this library), interleaving any time the call stack clears or you `await` something.

This means you can easily have more than one conceptual 'thing' happening at a time in your application code during testing, and you may want to work with milestones in more than one of those logical threads at a time.

### Working with Multiple Coordinators

As a general rule, you typically want one milestone coordinator for each logical thread of execution you're testing together. Put another way, **the milestones for each conceptual flow of control under test should be activated in a separate `activateMilestones` call**.

```ts
activateMilestones([MilestonesFor, ABackgroundPollingOperation]);
activateMilestones([OtherMilestones, ForTimingGrowlStyle, UserNotifications]);
```

When you call the `advanceTo` function importable from `@milestones/core`, it will automatically delegate to the active coordinator for the key you give it.

Alternatively, each `activateMilestones` call returns the `MilestoneCoordinator` instancec it creates. If you're dealing with very fine-grained interactions between the flows you're testing, though, and moving between them often, you may find your test code easier to follow if you invoke the `advanceTo` method on the corresponding coordinator itself.

```ts
let pollThread = activateMilestones([/*...*/]);
let notificationThread = activateMilestones([/*...*/]);

// ...

await pollThread.advanceTo('fetch').andReturn({ dataChanged: true });
await notificationThread.advanceTo('will-show-change-notification').andContinue();

// assert that the notification is visible
```

## Designating Default Behavior

When activating a set of milestones, it's also possible to designate a default behavior for those milestones.

```ts
activateMilestones([MyMilestone], {
  onMilestoneReached(milestone) {
    milestone.return();
  }
});
```

By specifying an `onMilestoneReached` callback for a coordinator, it can automatically handle any milestones under its jurisdiction rather than requiring that they be explicitly advanced to and then dealt with as part of your test logic. This allows you to effectively neutralize bits of behavior in your application code that aren't under test and might otherwise unnecessarily slow things down or otherwise make them unpredictable.

Note that if you _do_ explicitly `advanceTo` a milestone that belongs to a coordinator with a default handler, that handler won't be applied and you'll instead be able to decide what it does yourself, as long as you call `advanceTo` before that milestone is reached.

## Assigning Coordinators to Milestones

Every active milestone belongs to exactly one coordinator. Since milestones may have multiple keys associated with them, it's possible that two or more coordinators may potentially have jurisdiction over the same milestone. To handle this, milestones have a well-defined affinity for how they associate to a coordinator.

When a milestone is reached, it will first be associated to the active coordinator for its ID key. If no coordinator is active for its ID, each key in its `tags` array will be checked in order. If no tags match an active coordinator either, the milestone itself is inactive, and it will not pause.

This affinity toward a matching ID, followed by earlier tags, allows you to specify default behavior for some broad group of milestones using `onMilestoneReached` with one coordinator and then effectively override that for one particular one by activating its ID or higher-priority tag with another.
