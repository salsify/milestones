import { schedule } from '@ember/runloop';
import { advanceTo, deactivateAllMilestones, milestone, setupMilestones } from 'ember-milestones';
import { module, test } from 'qunit';
import { resolve } from 'rsvp';

module('Integration | milestones', function() {
  let scenarios = [
    { name: 'with string keys', milestones: ['one', 'two'] },
    { name: 'with symbol keys', milestones: [Symbol('one'), Symbol('two')] },
    { name: 'with mixed keys', milestones: ['one', Symbol('two')] },
  ];

  for (let { name, milestones: [keyOne, keyTwo] } of scenarios) {
    module(name, function(hooks) {
      let program: () => Promise<{ first: number, second: number }>;
      let location: string;

      hooks.beforeEach(function() {
        location = 'unstarted';
        program = async () => {
          location = 'before';
          let first = await milestone(keyOne, async () => { location = 'one-started'; return 1; });
          location = 'one-completed';
          let second = await milestone(keyTwo, async () => { location = 'two-started'; return 2; });
          location = 'two-completed';
          return { first, second };
        };
      });

      module('with no milestones active', function() {
        test('milestones with callbacks are inert', async function(assert) {
          let { first, second } = await program();
          assert.equal(location, 'two-completed');
          assert.equal(first, 1);
          assert.equal(second, 2);
        });

        test('milestones without callbacks are inert', async function(assert) {
          let program = async () => {
            let first = await milestone(keyOne);
            let second = await milestone(keyTwo);
            return { first, second };
          };

          assert.deepEqual(await program(), {
            first: undefined,
            second: undefined,
          });
        });
      });

      module('with milestones active', function(hooks) {
        setupMilestones(hooks, [keyOne, keyTwo]);

        test('skipping a milestone', async function(assert) {
          let programPromise = program();

          let two = await advanceTo(keyTwo);
          assert.equal(location, 'one-completed');

          two.continue();
          assert.equal(location, 'two-started');

          let { first, second } = await programPromise;
          assert.equal(location, 'two-completed');
          assert.equal(first, 1);
          assert.equal(second, 2);
        });

        test('advancing to an already-waiting milestone', async function(assert) {
          let programPromise = program();
          assert.equal(location, 'before');

          await advanceTo(keyOne);
          assert.equal(location, 'before');

          await advanceTo(keyTwo).andContinue();

          let { first, second } = await programPromise;
          assert.equal(first, 1);
          assert.equal(second, 2);
        });

        test('advancing to a not-yet-waiting milestone', async function(assert) {
          let advancePromise = advanceTo(keyTwo);

          let programPromise = program();
          assert.equal(location, 'one-started');

          await advancePromise;
          assert.equal(location, 'one-completed');

          deactivateAllMilestones();
          await programPromise;
        });

        test('advancing while paused at a previous milestone', async function(assert) {
          let programPromise = program();

          await advanceTo(keyOne);
          assert.equal(location, 'before');

          let two = await advanceTo(keyTwo);
          assert.equal(location, 'one-completed');

          two.continue();

          assert.deepEqual(await programPromise, { first: 1, second: 2 });
        });

        test('continuing occurs in a runloop', async function(assert) {
          let program = async () => {
            let run = false;
            await milestone(keyOne, async () => schedule('actions', () => run = true));
            return run;
          };

          let programPromise = program();
          let handle = await advanceTo(keyOne);

          handle.continue();
          assert.deepEqual(await programPromise, true);
        });

        test('stubbing a return value', async function(assert) {
          let programPromise = program();

          await advanceTo(keyOne).andReturn(111);
          await advanceTo(keyTwo).andReturn(222);
          assert.equal(location, 'two-completed');

          let { first, second } = await programPromise;
          assert.equal(first, 111);
          assert.equal(second, 222);
        });

        test('throwing an exception', async function(assert) {
          let boom = new Error('boom!');
          let program = async () => {
            try {
              await milestone(keyOne, async () => 'bad');
            } catch (error) {
              return error;
            }
          };

          advanceTo(keyOne).andThrow(boom);
          assert.equal(await program(), boom);
        });

        test('with no callback', async function(assert) {
          let program = async () => {
            let first = await milestone(keyOne);
            let second = await milestone(keyTwo);
            return { first, second };
          };

          let programPromise = program();
          await advanceTo(keyOne).andContinue();
          await advanceTo(keyTwo).andContinue();
          assert.deepEqual(await programPromise, { first: undefined, second: undefined });
        });

        test('stepping through each location', async function(assert) {
          let programPromise = program();

          let one = await advanceTo(keyOne);
          assert.equal(location, 'before');

          one.continue();
          assert.equal(location, 'one-started');

          let two = await advanceTo(keyTwo);
          assert.equal(location, 'one-completed');

          two.continue();
          assert.equal(location, 'two-started');

          await programPromise;
          assert.equal(location, 'two-completed');
        });

        test('nested milestones', async function(assert) {
          let program = async () => {
            location = 'before-out';
            let result = await milestone(keyOne, async () => {
              location = 'before-in';
              let inner = await milestone(keyTwo, async () => {
                location = 'in';
                return 'ok';
              });
              location = 'after-in';
              return inner;
            });
            location = 'after-out';
            return result;
          };

          let programPromise = program();

          let one = await advanceTo(keyOne);
          assert.equal(location, 'before-out');

          let two = await advanceTo(keyTwo);
          assert.equal(location, 'before-in');

          let twoCompletion = two.continue({ immediate: true });
          assert.equal(location, 'in');

          await twoCompletion;
          assert.equal(location, 'after-in');

          await one.continue();
          assert.equal(location, 'after-out');

          assert.equal(await programPromise, 'ok');
        });

        test('immediate vs deferred continuation', async function(assert) {
          let program = async () => {
            location = 'before';

            let result = await milestone(keyOne, async () => 'ok');

            location = 'between';

            await resolve();

            location = 'after';

            return result;
          };

          let programPromise = program();
          assert.equal(location, 'before');
          await advanceTo(keyOne).andContinue({ immediate: true });
          assert.equal(location, 'between');
          assert.equal(await programPromise, 'ok');

          programPromise = program();
          assert.equal(location, 'before');
          await advanceTo(keyOne).andContinue();
          assert.equal(location, 'after');
          assert.equal(await programPromise, 'ok');
        });
      });
    });
  }

  module('with multiple milestone sets active', function(hooks) {
    let keyOne = Symbol('one');
    let keyFour = Symbol('four');

    setupMilestones(hooks, [keyOne, 'two']);
    setupMilestones(hooks, ['three', keyFour]);

    test('they can be controlled independently', async function(assert) {
      let state: { [key: string]: any } = {};
      let program = async (key: string, milestones: Array<string | symbol>) => {
        state[key] = 'before';
        let first = await milestone(milestones[0], async () => 1);
        state[key] = 'between';
        let second = await milestone(milestones[1], async () => 2);
        state[key] = 'after';
        return first + second;
      };

      let first = program('first', [keyOne, 'two']);
      let second = program('second', ['three', keyFour]);

      assert.equal(state.first, 'before');
      assert.equal(state.second, 'before');

      await advanceTo(keyOne).andReturn(98);

      assert.equal(state.first, 'between');
      assert.equal(state.second, 'before');

      await advanceTo(keyFour).andReturn(9);

      assert.equal(state.first, 'between');
      assert.equal(state.second, 'after');

      await advanceTo('two').andContinue();

      assert.equal(state.first, 'after');
      assert.equal(state.second, 'after');

      assert.equal(await first, 100);
      assert.equal(await second, 10);
    });

    test('all active milestones can be deactivated', async function(assert) {
      let program = async (milestones: Array<string | symbol>) => {
        let first = await milestone(milestones[0], async () => 2);
        let second = await milestone(milestones[1], async () => 3);
        return first * second;
      };

      let first = program([keyOne, 'two']);
      deactivateAllMilestones();
      let second = program(['three', keyFour]);

      assert.equal(await first, 6);
      assert.equal(await second, 6);
    });
  });
});
