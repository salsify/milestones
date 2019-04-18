# The Playground

Many of the examples in this documentation make use of an interactive playground to demonstrate the flow of code when using milestones in a particular way.

## Stepping Through Code

Each playground has three main controls: a Play/Pause button, a Step button, and a Reset button. When you click Play, the code will begin to execute line by line, with the line that will next run highlighted, and clicking Pause will stop execution wherever it is. Clicking Step will advance the code a single step and then leave it paused there.

<MilestonesPlayground @lines={{4}} @showConsole={{true}} as |pg|>
  <pg.preamble>
  ```ts
  import { log } from '@milestones/playground';
  ```
  </pg.preamble>

  <pg.editor @title="Code">
  ```ts
  log('one');
  log('two');
  log('three');
  ```
  </pg.editor>
</MilestonesPlayground>

For examples with multiple code blocks, synchronous execution will start in each block from left to right. When execution pauses (e.g. at an `await` expression), the highlight on that line will dim and any other blocks will have a chance to proceed.

<MilestonesPlayground @lines={{4}} @showConsole={{true}} as |pg|>
  <pg.preamble>
  ```ts
  import { log } from '@milestones/playground';

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  ```
  </pg.preamble>

  <pg.editor @title="Block A">
  ```ts
  log('a1');
  await sleep(1000);
  log('a2');
  ```
  </pg.editor>

  <pg.editor @title="Block B">
  ```ts
  log('b1');
  await sleep(1000);
  log('b2');
  ```
  </pg.editor>
</MilestonesPlayground>

This is a rough approximation of how JavaScript actually executes: synchronous code continues until the stack empties or you `await` a promise, and then the next pending task begins execution. While no guarantees are made that a playground example will perfectly match actual execution behavior, it should be high-fidelity enough to demonstrate the concepts necessary to understand milestones in this documentation.

## Configuring the Playground

Each playground instance has a small {{fa-icon 'cog'}} icon in the top right. Clicking this gives you the opportunity to show and hide various bits of the playground (detailed below) that aren't necessarily relevant to every example.

You can also adjust the playback speed of the example when the Play button is clicked. The further to the right the slider is, the faster the example will proceed from one step to the next.

## Preamble Code

Though it's usually hidden, every playground example includes some **Preamble Code** that's executed just before the visible blocks begin to run. Any identifiers introduced here are available in all the following code blocks, which makes it a perfect place to put `import` statements and define any shared values or helpers the blocks will use.

You can make this section visible for any example to see what setup was necessary in order for it to work.

## Playground Imports

A few special imports are available from the `@milestones/playground` module to make it easier to see the effects that code is having as it executes.

### Console Output

The `log` function will write a message to the **Console Output** section of the playground. If this section is hidden, it will automatically be shown the first time `log` is called. Anything written via `log` will also be emitted to the browser developer console.

<MilestonesPlayground @lines={{4}} @showConsole={{true}} @showPreamble={{true}} as |pg|>
  <pg.preamble @minLines={{2}}>
  ```ts
  import { log } from '@milestones/playground';
  ```
  </pg.preamble>

  <pg.editor @title="Code">
  ```ts
  log('one');
  log('two');
  log('three');
  ```
  </pg.editor>
</MilestonesPlayground>

### DOM Output

The `element` value is an `HTMLDivElement`. If the **DOM Output** section is shown, this element will be present in that section and you can interact with it in your code however you like and see the results there.

<MilestonesPlayground @lines={{6}} @showDOM={{true}} @showPreamble={{true}} as |pg|>
  <pg.preamble @minLines={{2}}>
  ```ts
  import { element } from '@milestones/playground';
  ```
  </pg.preamble>

  <pg.editor @title="Code">
  ```ts
  element.innerText = 'Hello';
  element.style.padding = '1em';
  element.style.backgroundColor = 'pink';
  element.style.color = 'blue';
  element.style.fontWeight = 'bold';
  ```
  </pg.editor>
</MilestonesPlayground>
