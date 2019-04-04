import { describe, test, afterEach } from 'mocha';
import { expect } from 'chai';
import { milestone, advanceTo, activateMilestones, deactivateAllMilestones } from '../src/index';

describe('Tags', () => {
  afterEach(() => deactivateAllMilestones());

  for (let [kind, key] of [['string', 'key'], ['symbol', Symbol('key')]]) {
    describe(`with ${kind.toString()} keys`, () => {
      test('activating by tag', async () => {
        activateMilestones([key]);

        let program = async (): Promise<string> => {
          return await milestone(Symbol(), async () => 'hi', { tags: [key] });
        };

        let promise = program();
        await advanceTo(key).andReturn('done');
        expect(await promise).to.equal('done');
      });

      test('advancing by tags', async () => {
        activateMilestones([key]);

        let program = async (): Promise<[string, string]> => {
          return await Promise.all([
            milestone(Symbol(), async () => 'hello', { tags: [key] }),
            milestone(Symbol(), async () => 'world', { tags: [key] }),
          ]);
        };

        let promise = program();
        await advanceTo(key).andContinue();
        await advanceTo(key).andContinue();
        expect(await promise).to.deep.equal(['hello', 'world']);
      });
    });
  }
});
