import { module, test } from 'qunit';
import { milestone, setupMilestones, advanceTo, deactivateAllMilestones } from 'ember-milestones';

module('Integration | milestones', function(hooks) {
  hooks.beforeEach(function() {
    this.program = async () => {
      this.location = 'before';
      let first = await milestone('one', () => { this.location = 'one-started'; return 1; });
      this.location = 'one-completed';
      let second = await milestone('two', () => { this.location = 'two-started'; return 2; });
      this.location = 'two-completed';
      return { first, second };
    };
  });

  module('with no milestones active', function() {
    test('milestones are inert', async function(assert) {
      let { first, second } = await this.program();
      assert.equal(this.location, 'two-completed');
      assert.equal(first, 1);
      assert.equal(second, 2);
    });
  });

  module('with milestones active', function(hooks) {
    setupMilestones(hooks, ['one', 'two']);

    test('skipping a milestone', async function(assert) {
      let programPromise = this.program();

      let two = await advanceTo('two');
      assert.equal(this.location, 'one-completed');

      two.continue();
      assert.equal(this.location, 'two-started');

      let { first, second } = await programPromise;
      assert.equal(this.location, 'two-completed');
      assert.equal(first, 1);
      assert.equal(second, 2);
    });

    test('advancing to an already-waiting milestone', async function(assert) {
      let programPromise = this.program();
      assert.equal(this.location, 'before');

      await advanceTo('one');
      assert.equal(this.location, 'before');

      await advanceTo('two').andContinue();

      let { first, second } = await programPromise;
      assert.equal(first, 1);
      assert.equal(second, 2);
    });

    test('advancing to a not-yet-waiting milestone', async function(assert) {
      let advancePromise = advanceTo('two');

      this.program();
      assert.equal(this.location, 'one-started');

      await advancePromise;
      assert.equal(this.location, 'one-completed');
    });

    test('advancing while paused at a previous milestone', async function(assert) {
      let programPromise = this.program();

      await advanceTo('one');
      assert.equal(this.location, 'before');

      let two = await advanceTo('two');
      assert.equal(this.location, 'one-completed');

      two.continue();

      assert.deepEqual(await programPromise, { first: 1, second: 2 });
    });

    test('stubbing a return value', async function(assert) {
      let programPromise = this.program();

      await advanceTo('one').andReturn(111);
      await advanceTo('two').andReturn(222);
      assert.equal(this.location, 'two-completed');

      let { first, second } = await programPromise;
      assert.equal(first, 111);
      assert.equal(second, 222);
    });

    test('throwing an exception', async function(assert) {
      let boom = new Error('boom!');
      let program = async () => {
        try {
          await milestone('one', () => 'bad');
        } catch (error) {
          return error;
        }
      };

      advanceTo('one').andThrow(boom);
      assert.equal(await program(), boom);
    });

    test('stepping through each location', async function(assert) {
      let programPromise = this.program();

      let one = await advanceTo('one');
      assert.equal(this.location, 'before');

      one.continue();
      assert.equal(this.location, 'one-started');

      let two = await advanceTo('two');
      assert.equal(this.location, 'one-completed');

      two.continue();
      assert.equal(this.location, 'two-started');

      await programPromise;
      assert.equal(this.location, 'two-completed');
    });

    test('nested milestones', async function(assert) {
      let program = async () => {
        this.location = 'before-out';
        let result = await milestone('one', async () => {
          this.location = 'before-in';
          let inner = await milestone('two', async () => {
            this.location = 'in';
            return 'ok';
          });
          this.location = 'after-in';
          return inner;
        });
        this.location = 'after-out';
        return result;
      };

      let programPromise = program();

      let one = await advanceTo('one');
      assert.equal(this.location, 'before-out');

      let two = await advanceTo('two');
      assert.equal(this.location, 'before-in');

      let twoCompletion = two.continue({ immediate: true });
      assert.equal(this.location, 'in');

      await twoCompletion;
      assert.equal(this.location, 'after-in');

      await one.continue();
      assert.equal(this.location, 'after-out');

      assert.equal(await programPromise, 'ok');
    });

    test('immediate vs deferred continuation', async function(assert) {
      let program = async () => {
        this.location = 'before';

        let result = await milestone('one', async () => 'ok');

        this.location = 'between';

        await null;

        this.location = 'after';

        return result;
      };

      let programPromise = program();
      assert.equal(this.location, 'before');
      await advanceTo('one').andContinue({ immediate: true });
      assert.equal(this.location, 'between');
      assert.equal(await programPromise, 'ok');

      programPromise = program();
      assert.equal(this.location, 'before');
      await advanceTo('one').andContinue();
      assert.equal(this.location, 'after');
      assert.equal(await programPromise, 'ok');
    });
  });

  module('with multiple milestone sets active', function(hooks) {
    setupMilestones(hooks, ['one', 'two']);
    setupMilestones(hooks, ['three', 'four']);

    test('they can be controlled independently', async function(assert) {
      let state = {};
      let program = async (key, milestones) => {
        state[key] = 'before';
        let first = await milestone(milestones[0], () => 1);
        state[key] = 'between';
        let second = await milestone(milestones[1], () => 2);
        state[key] = 'after';
        return first + second;
      };

      let first = program('first', ['one', 'two']);
      let second = program('second', ['three', 'four']);

      assert.equal(state.first, 'before');
      assert.equal(state.second, 'before');

      await advanceTo('one').andReturn(98);

      assert.equal(state.first, 'between');
      assert.equal(state.second, 'before');

      await advanceTo('four').andReturn(9);

      assert.equal(state.first, 'between');
      assert.equal(state.second, 'after');

      await advanceTo('two').andContinue();

      assert.equal(state.first, 'after');
      assert.equal(state.second, 'after');

      assert.equal(await first, 100);
      assert.equal(await second, 10);
    });

    test('all active milestones can be deactivated', async function(assert) {
      let program = async (milestones) => {
        let first = await milestone(milestones[0], () => 2);
        let second = await milestone(milestones[1], () => 3);
        return first * second;
      };

      let first = program(['one', 'two']);
      deactivateAllMilestones();
      let second = program(['three', 'four']);

      assert.equal(await first, 6);
      assert.equal(await second, 6);
    });
  });
});
