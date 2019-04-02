import { describe, test, afterEach } from 'mocha';
import { expect } from 'chai';
import {
  milestone,
  advanceTo,
  activateMilestones,
  deactivateAllMilestones,
  MilestoneCoordinator,
  MilestoneKey,
} from '../src/index';

describe('Integration: Core APIs', () => {
  let scenarios = [
    { name: 'with string keys', milestones: ['one', 'two'] },
    { name: 'with symbol keys', milestones: [Symbol('one'), Symbol('two')] },
    { name: 'with mixed keys', milestones: ['one', Symbol('two')] },
  ];

  for (let {
    name,
    milestones: [keyOne, keyTwo],
  } of scenarios) {
    describe(name, () => {
      let location: string;
      let program = async (): Promise<{ first: number; second: number }> => {
        location = 'before';
        let first = await milestone(keyOne, async () => {
          location = 'one-started';
          return 1;
        });
        location = 'one-completed';
        let second = await milestone(keyTwo, async () => {
          location = 'two-started';
          return 2;
        });
        location = 'two-completed';
        return { first, second };
      };

      beforeEach(function() {
        location = 'unstarted';
      });

      describe('with no milestones active', () => {
        test('milestones with callbacks are inert', async function() {
          let { first, second } = await program();
          expect(location).to.equal('two-completed');
          expect(first).to.equal(1);
          expect(second).to.equal(2);
        });

        test('milestones without callbacks are inert', async function() {
          let program = async (): Promise<{ first: void; second: void }> => {
            let first = await milestone(keyOne);
            let second = await milestone(keyTwo);
            return { first, second };
          };

          expect(await program()).to.deep.equal({
            first: undefined,
            second: undefined,
          });
        });
      });

      describe('with milestones active', () => {
        let coordinator: MilestoneCoordinator;
        beforeEach(() => {
          coordinator = activateMilestones([keyOne, keyTwo]);
        });

        afterEach(() => {
          coordinator.deactivateAll();
        });

        test('skipping a milestone', async () => {
          let programPromise = program();

          let two = await advanceTo(keyTwo);
          expect(location).to.equal('one-completed');

          two.continue();
          expect(location).to.equal('two-started');

          let { first, second } = await programPromise;
          expect(location).to.equal('two-completed');
          expect(first).to.equal(1);
          expect(second).to.equal(2);
        });

        test('advancing to an already-waiting milestone', async () => {
          let programPromise = program();
          expect(location).to.equal('before');

          await advanceTo(keyOne);
          expect(location).to.equal('before');

          await advanceTo(keyTwo).andContinue();

          let { first, second } = await programPromise;
          expect(first).to.equal(1);
          expect(second).to.equal(2);
        });

        test('advancing to a not-yet-waiting milestone', async () => {
          let advancePromise = advanceTo(keyTwo);

          let programPromise = program();
          expect(location).to.equal('one-started');

          await advancePromise;
          expect(location).to.equal('one-completed');

          deactivateAllMilestones();
          await programPromise;
        });

        test('advancing while paused at a previous milestone', async () => {
          let programPromise = program();

          await advanceTo(keyOne);
          expect(location).to.equal('before');

          let two = await advanceTo(keyTwo);
          expect(location).to.equal('one-completed');

          two.continue();

          expect(await programPromise).to.deep.equal({ first: 1, second: 2 });
        });

        test('stubbing a return value', async () => {
          let programPromise = program();

          await advanceTo(keyOne).andReturn(111);
          await advanceTo(keyTwo).andReturn(222);
          expect(location).to.equal('two-completed');

          let { first, second } = await programPromise;
          expect(first).to.equal(111);
          expect(second).to.equal(222);
        });

        test('throwing an exception', async () => {
          let boom = new Error('boom!');
          let program = async (): Promise<void> => {
            try {
              await milestone(keyOne, async () => 'bad');
            } catch (error) {
              return error;
            }
          };

          advanceTo(keyOne).andThrow(boom);
          expect(await program()).to.equal(boom);
        });

        test('with no callback', async () => {
          let program = async (): Promise<{ first: void; second: void }> => {
            let first = await milestone(keyOne);
            let second = await milestone(keyTwo);
            return { first, second };
          };

          let programPromise = program();
          await advanceTo(keyOne).andContinue();
          await advanceTo(keyTwo).andContinue();
          expect(await programPromise).to.deep.equal({ first: undefined, second: undefined });
        });

        test('stepping through each location', async () => {
          let programPromise = program();

          let one = await advanceTo(keyOne);
          expect(location).to.equal('before');

          one.continue();
          expect(location).to.equal('one-started');

          let two = await advanceTo(keyTwo);
          expect(location).to.equal('one-completed');

          two.continue();
          expect(location).to.equal('two-started');

          await programPromise;
          expect(location).to.equal('two-completed');
        });

        test('nested milestones', async () => {
          let program = async (): Promise<string> => {
            location = 'before-out';
            let result = await milestone(keyOne, async () => {
              location = 'before-in';
              let inner = await milestone(keyTwo, async () => 'ok');
              location = 'after-in';
              return inner;
            });
            location = 'after-out';
            return result;
          };

          let programPromise = program();

          let one = await advanceTo(keyOne);
          expect(location).to.equal('before-out');

          let two = await advanceTo(keyTwo);
          expect(location).to.equal('before-in');

          await two.continue({ immediate: true });
          expect(location).to.equal('after-in');

          await one.continue();
          expect(location).to.equal('after-out');

          expect(await programPromise).to.equal('ok');
        });
      });
    });
  }

  describe('with a default handler configured', async () => {
    afterEach(() => deactivateAllMilestones());

    it('invokes the default handler when a milestone is reached normally', async () => {
      activateMilestones(['one'], {
        onMilestoneReached: handle => handle.return('ok'),
      });

      let program = async (): Promise<string> => {
        return await milestone('one', async () => 'bad');
      };

      expect(await program()).to.equal('ok');
    });

    it('does not invoke the default handler for the target milestone', async () => {
      activateMilestones(['one'], {
        onMilestoneReached: handle => handle.throw(new Error('boom')),
      });

      let advancePromise = advanceTo('one');
      let program = async (): Promise<string> => {
        return await milestone('one', async () => 'bad');
      };

      let programPromise = program();
      await advancePromise.andReturn('ok');
      expect(await programPromise).to.equal('ok');
    });

    it('invokes the default handler when advancing to another target', async () => {
      activateMilestones(['one', 'two'], {
        onMilestoneReached: handle => handle.return('hello'),
      });

      let program = async (): Promise<string[]> => {
        let one = await milestone('one', async () => 'x');
        let two = await milestone('two', async () => 'world');
        return [one, two];
      };

      let advancePromise = advanceTo('two');
      let programPromise = program();
      await advancePromise.andReturn('world');
      expect(await programPromise).to.deep.equal(['hello', 'world']);
    });
  });

  describe('with multiple milestone sets active', () => {
    let keyOne = Symbol('one');
    let keyFour = Symbol('four');

    let coordinatorOne: MilestoneCoordinator;
    let coordinatorTwo: MilestoneCoordinator;

    beforeEach(() => {
      coordinatorOne = activateMilestones([keyOne, 'two']);
      coordinatorTwo = activateMilestones(['three', keyFour]);
    });

    afterEach(() => {
      coordinatorOne.deactivateAll();
      coordinatorTwo.deactivateAll();
    });

    test('they can be controlled independently', async () => {
      let state: { [key: string]: unknown } = {};
      let program = async (key: string, milestones: MilestoneKey[]): Promise<number> => {
        state[key] = 'before';
        let first = await milestone(milestones[0], async () => 1);
        state[key] = 'between';
        let second = await milestone(milestones[1], async () => 2);
        state[key] = 'after';
        return first + second;
      };

      let first = program('first', [keyOne, 'two']);
      let second = program('second', ['three', keyFour]);

      expect(state.first).to.equal('before');
      expect(state.second).to.equal('before');

      await advanceTo(keyOne).andReturn(98);

      expect(state.first).to.equal('between');
      expect(state.second).to.equal('before');

      await advanceTo(keyFour).andReturn(9);

      expect(state.first).to.equal('between');
      expect(state.second).to.equal('after');

      await advanceTo('two').andContinue();

      expect(state.first).to.equal('after');
      expect(state.second).to.equal('after');

      expect(await first).to.equal(100);
      expect(await second).to.equal(10);
    });

    test('all active milestones can be deactivated', async () => {
      let program = async (milestones: MilestoneKey[]): Promise<number> => {
        let first = await milestone(milestones[0], async () => 2);
        let second = await milestone(milestones[1], async () => 3);
        return first * second;
      };

      let first = program([keyOne, 'two']);
      deactivateAllMilestones();
      let second = program(['three', keyFour]);

      expect(await first).to.equal(6);
      expect(await second).to.equal(6);
    });
  });
});
