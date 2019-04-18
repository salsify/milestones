# Referencing Milestones

Milestones effectively act as a way to cut small holes through the normal architectural abstractions in your code to allow for finer-grained control from your tests. Because of this, it's helpful to be as explicit as possible when choosing IDs and tags for your milestones to avoid accidental clashes.

Assuming your environment supports them, symbols generally are a much safer option for milestone keys than strings.

## Using Strings

Using strings as milestone keys is the easiest way to get started. All you need to do is use the same string in both places and you're good to go. However, this simplicity is also what makes using strings as milestone keys hazardous—if you or someone else decide to use the same string as a key elsewhere in your code, you may accidentally end up activating more milestones than you intend.

When using strings as milestone keys, a good precaution is to prefix every key used in a particular module with some identifying part of that module's name.

```ts
await milestone('my-polling-module#timeout', async () => {
  // ...
});
```

This way, even if two milestones have keys that are based on the same short name like `timeout`, you'll avoid a clash.

## Using Symbols

Symbols are a safer alternative to strings, since you can use the same name for different symbols and each one will still be considered unique.

They require a bit of boilerplate to use, since you need to actually share the symbols between your application and test code, but this is a blessing in disguise: it makes the available milestones for a module part of its explicit interface.

```ts
export const PollTimeout = Symbol('poll-timeout');

// ...

await milestone(PollTimeout, async () => {
  // ...
});
```

```ts
import { PollTimeout } from '.../my-polling-module';

// ...

await advanceTo(PollTimeout);

// ...
```
