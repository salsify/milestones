import EmberObject from '@ember/object';
import { run } from '@ember/runloop';
import { advanceTo, milestone, setupMilestones, TestHooks } from 'ember-milestones';
import { module, test } from 'qunit';
import require from 'require';

module('Integration | ember-concurrency interop', function(hooks: TestHooks) {
  setupMilestones(hooks, ['one', 'two']);

  if (require.has('ember-concurrency')) {
    const { task, didCancel } = require('ember-concurrency');
    class TaskHost extends EmberObject.extend({
      unlinked: false,

      task: task(function*(this: TaskHost) {
        return yield milestone('one', () => {
          let subtask = this.get('subtask');
          if (this.get('unlinked')) {
            subtask = subtask.unlinked();
          }
          return subtask.perform();
        });
      }),

      subtask: task(function*() {
        yield milestone('two', async () => undefined);
      }),
    }) {}

    test('task linkage from parent -> child', async function(assert) {
      let host = TaskHost.create();
      host.get('task').perform();

      await advanceTo('two');
      assert.ok(host.get('task').get('isRunning'));
      assert.ok(host.get('subtask').get('isRunning'));

      run(() => host.get('task').cancelAll());
      assert.ok(didCancel(host.get('task').get('last.error')));
      assert.ok(didCancel(host.get('subtask').get('last.error')));
    });

    test('task linkage from child -> parent', async function(assert) {
      let host = TaskHost.create();
      host.get('task').perform();

      await advanceTo('two');
      assert.ok(host.get('task').get('isRunning'));
      assert.ok(host.get('subtask').get('isRunning'));

      // Cancel child -> parent
      run(() => host.get('subtask').cancelAll());
      assert.ok(didCancel(host.get('task').get('last.error')));
      assert.ok(didCancel(host.get('subtask').get('last.error')));
    });

    test('unlinked child task', async function(assert) {
      let host = TaskHost.create({ unlinked: true });
      host.get('task').perform();

      let two = await advanceTo('two');
      assert.ok(host.get('task').get('isRunning'));
      assert.ok(host.get('subtask').get('isRunning'));

      run(() => host.get('task').cancelAll());
      await two.continue();

      assert.ok(didCancel(host.get('task').get('last.error')));
      assert.ok(host.get('subtask').get('last.isSuccessful'));
    });

    test('milestone cancellation', async function(assert) {
      let host = TaskHost.create();
      host.get('task').perform();

      let two = await advanceTo('two');
      assert.ok(host.get('task').get('isRunning'));
      assert.ok(host.get('subtask').get('isRunning'));

      run(() => two.cancel());
      assert.ok(didCancel(host.get('task').get('last.error')));
      assert.ok(didCancel(host.get('subtask').get('last.error')));
    });

    test('milestone cancellation outside a task', async function(assert) {
      let program = async () => {
        try {
          await milestone('one', async () => null);
        } catch (error) {
          return error;
        }
      };

      advanceTo('one').andCancel();
      assert.ok(didCancel(await program()));
    });
  } else {
    test('a useful error is given when trying to cancel without ember-concurrency', async function(assert) {
      let program = async () => await milestone('one', async () => null);

      program();
      try {
        await advanceTo('one').andCancel();
        assert.ok(false, 'Error should have been thrown');
      } catch (error) {
        assert.ok(/ember-concurrency/.test(error.message));
      }
    });
  }
});
