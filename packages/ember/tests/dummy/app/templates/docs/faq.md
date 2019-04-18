# FAQ

 - **Q**: Isn't this allowing test-oriented logic to leak into my application?

  **A**: Think of it as sort of like adding [test selectors](https://kentcdodds.com/blog/making-your-ui-tests-resilient-to-change) to DOM nodes, except you're annotating asynchronous code instead.

 - **Q**: Isn't this providing a tool to completely cross-cut all the normal architectural boundaries we rely on to keep our code from devolving into a mess of spaghetti?

  **A**: Yep! But only for testing/development purposes, and in a fairly controlled way. Use your best judgment. ¯\\\_(ツ)_/¯

