import { milestone } from '@milestones/core';

export const Hello = Symbol();

export function hello(): Promise<string> {
  return milestone(Hello, async () => 'hello');
}
