# Milestones [![Build Status](https://travis-ci.org/salsify/milestones.svg?branch=master)](https://travis-ci.org/salsify/milestones)

The `@milestones` packages provide a set of tools for navigating concurrent code in testing and development. Milestones act as named synchronization points, and they give you the ability to change the behavior of annotated code during testing, skipping pauses or mocking out results.

Full interactive documentation can be found at https://salsify.github.io/milestones.

## Packages

This library is broken out into several packages:
 - [@milestones/core](packages/core): the core library, containing tools for defining and interacting with milestones
 - [@milestones/babel-plugin-strip-milestones](packages/babel-plugin-strip-milestones): a Babel plugin that removes milestone definitions from your code, ensuring no overhead in production
 - [@milestones/ember](packages/ember): an Ember addon that integrates with the framework runtime and build system to provide zero-config setup for working with milestones
