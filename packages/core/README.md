# @milestones/core

Milestones are a tool for annotating points in time in your code.

A milestone can act as a named synchronization point, allowing you to ensure the state of your application code at the moment in time in your testing when you wish to make assertions. They also give you the ability to change the behavior of annotated code during testing, skipping pauses or mocking out results.

Full interactive documentation can be found at https://salsify.github.io/milestones.

## Example

#### Application Code
```ts
import { milestone } from '@milestones/core';

export const Save = Symbol('save');
export const ShowCompletion = Symbol('show-completion-message');

// ...

async function save() {
  renderMessage('Saving...');
  await milestone(Save, () => saveData());

  renderMessage('Saved!');
  await milestone(ShowCompletion, () => sleep(4000));

  renderMessage('');
}
```

#### Test Code
```ts
import { advanceTo } from '@milestones/core';
import { Save, ShowCompletion } from '../app/code/under/test';

// ...

it('renders the current saving status', async () => {
  click('.save-button');

  // Wait until we start saving, then check that
  // the expected message is being shown.
  let saveHandle = await advanceTo(Save);
  expect(currentMessage()).to.equal('Saving...');

  // Now go ahead and perform the save
  await saveHandle.continue();
  expect(currentMessage()).to.equal('Saved!');

  // Now advance to where we pause to show the
  // the status message, but skip the sleep
  await advanceTo(ShowCompletion).andReturn();
  expect(currentMessage()).to.equal('');
});
```
