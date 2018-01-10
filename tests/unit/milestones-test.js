import require from 'require';
import EmberObject from '@ember/object';
import { run } from '@ember/runloop';
import { module, test } from 'qunit';
import { milestone, setupMilestones } from 'ember-milestones';

module('Unit | milestones', function(hooks) {
  setupMilestones(hooks, ['one', 'two']);

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

  test('with no milestones active', async function(assert) {
    this.milestones.deactivateAll();

    let { first, second } = await this.program();
    assert.equal(this.location, 'two-completed');
    assert.equal(first, 1);
    assert.equal(second, 2);
  });

  test('skipping a milestone', async function(assert) {
    let programPromise = this.program();

    let two = await this.milestones.advanceTo('two');
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

    await this.milestones.advanceTo('one');
    assert.equal(this.location, 'before');

    this.milestones.deactivateAll();

    let { first, second } = await programPromise;
    assert.equal(first, 1);
    assert.equal(second, 2);
  });

  test('advancing to a not-yet-waiting milestone', async function(assert) {
    let advancePromise = this.milestones.advanceTo('two');

    this.program();
    assert.equal(this.location, 'one-started');

    await advancePromise;
    assert.equal(this.location, 'one-completed');
  });

  test('advancing while paused at a previous milestone', async function(assert) {
    let programPromise = this.program();

    await this.milestones.advanceTo('one');
    assert.equal(this.location, 'before');

    await this.milestones.advanceTo('two');
    assert.equal(this.location, 'one-completed');

    this.milestones.deactivateAll();

    assert.deepEqual(await programPromise, { first: 1, second: 2 });
  });

  test('stubbing a return value', async function(assert) {
    let programPromise = this.program();

    await this.milestones.advanceTo('one').andReturn(111);
    await this.milestones.advanceTo('two').andReturn(222);
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

    this.milestones.advanceTo('one').andThrow(boom);
    assert.equal(await program(), boom);
  });

  test('stepping through each location', async function(assert) {
    let programPromise = this.program();

    let one = await this.milestones.advanceTo('one');
    assert.equal(this.location, 'before');

    one.continue();
    assert.equal(this.location, 'one-started');

    let two = await this.milestones.advanceTo('two');
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

    let one = await this.milestones.advanceTo('one');
    assert.equal(this.location, 'before-out');

    let two = await this.milestones.advanceTo('two');
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
    await this.milestones.advanceTo('one').andContinue({ immediate: true });
    assert.equal(this.location, 'between');
    assert.equal(await programPromise, 'ok');

    programPromise = program();
    assert.equal(this.location, 'before');
    await this.milestones.advanceTo('one').andContinue();
    assert.equal(this.location, 'after');
    assert.equal(await programPromise, 'ok');
  });

  if (require.has('ember-concurrency')) {
    const { task, didCancel } = require('ember-concurrency');
    const TaskHost = EmberObject.extend({
      task: task(function*() {
        return yield milestone('one', () => this.get('subtask').perform());
      }),

      subtask: task(function*() {
        yield milestone('two', () => {});
      }),
    });

    test('task linkage from parent -> child', async function(assert) {
      let host = TaskHost.create();
      host.get('task').perform();

      await this.milestones.advanceTo('two');
      assert.ok(host.get('task.isRunning'));
      assert.ok(host.get('subtask.isRunning'));

      run(() => host.get('task').cancelAll());
      assert.ok(didCancel(host.get('task.last.error')));
      assert.ok(didCancel(host.get('subtask.last.error')));
    });

    test('task linkage from child -> parent', async function(assert) {
      let host = TaskHost.create();
      host.get('task').perform();

      await this.milestones.advanceTo('two');
      assert.ok(host.get('task.isRunning'));
      assert.ok(host.get('subtask.isRunning'));

      // Cancel child -> parent
      run(() => host.get('subtask').cancelAll());
      assert.ok(didCancel(host.get('task.last.error')));
      assert.ok(didCancel(host.get('subtask.last.error')));
    });

    test('milestone cancellation', async function(assert) {
      let host = TaskHost.create();
      host.get('task').perform();

      let two = await this.milestones.advanceTo('two');
      assert.ok(host.get('task.isRunning'));
      assert.ok(host.get('subtask.isRunning'));

      run(() => two.cancel());
      assert.ok(didCancel(host.get('task.last.error')));
      assert.ok(didCancel(host.get('subtask.last.error')));
    });
  } else {
    test('a useful error is given when trying to cancel without ember-concurrency', async function(assert) {
      this.program();
      try {
        await this.milestones.advanceTo('one').andCancel();
        assert.ok(false, 'Error should have been thrown');
      } catch (error) {
        assert.ok(/ember-concurrency/.test(error.message));
      }
    });
  }
});
