# Babel Plugin

By default, all milestones in your code are inert and pass right through to their given callback. The `@milestones/babel-plugin-strip-milestones` package allows you to strip the `milestone()` calls completely out of your code to eliminate all overhead in production.

## Usage

Babel's plugin naming conventions allow you to strip milestones from your build by adding `'@milestones/strip-milestones'` to your `plugins` array in your `babel.config.json` or the corresponding configuration location for your particular Babel integration.

You can also apply it by hand:

```ts
import { transformSync } from '@babel/core';

let { code } = transformSync(input, {
  plugins: ['@milestones/strip-milestones']
});
```

## Behavior

Milestones with a callback are replaced with code that immediately invokes that callback:

```ts
// Before:
await milestone('foo', async () => 2 + await someNumberPromise);

// After:
await (async () => 2 + await someNumberPromise)();
```

Milestones with no callback are replaced with `undefined`.

```ts
// Before:
await milestone('foo');

// After:
await undefined;
```
