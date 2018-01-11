import { module, test } from 'qunit';
import { milestone, advanceTo, setupMilestones } from 'ember-milestones';
import require from 'require';
import EmberObject from '@ember/object';
import { run } from '@ember/runloop';

module('Integration | ember-concurrency interop', function(hooks) {
  setupMilestones(hooks, ['one', 'two']);

  if (require.has('ember-concurrency')) {
    const { task, didCancel } = require('ember-concurrency');
    const TaskHost = EmberObject.extend({
      task: task(function*() {
        return yield milestone('one', () => {
          let task = this.get('subtask');
          if (this.get('unlinked')) {
            task = task.unlinked();
          }
          return task.perform();
        });
      }),

      subtask: task(function*() {
        yield milestone('two', () => {});
      }),
    });

    test('task linkage from parent -> child', async function(assert) {
      let host = TaskHost.create();
      host.get('task').perform();

      await advanceTo('two');
      assert.ok(host.get('task.isRunning'));
      assert.ok(host.get('subtask.isRunning'));

      run(() => host.get('task').cancelAll());
      assert.ok(didCancel(host.get('task.last.error')));
      assert.ok(didCancel(host.get('subtask.last.error')));
    });

    test('task linkage from child -> parent', async function(assert) {
      let host = TaskHost.create();
      host.get('task').perform();

      await advanceTo('two');
      assert.ok(host.get('task.isRunning'));
      assert.ok(host.get('subtask.isRunning'));

      // Cancel child -> parent
      run(() => host.get('subtask').cancelAll());
      assert.ok(didCancel(host.get('task.last.error')));
      assert.ok(didCancel(host.get('subtask.last.error')));
    });

    test('unlinked child task', async function(assert) {
      let host = TaskHost.create({ unlinked: true });
      host.get('task').perform();

      let two = await advanceTo('two');
      assert.ok(host.get('task.isRunning'));
      assert.ok(host.get('subtask.isRunning'));

      run(() => host.get('task').cancelAll());
      await two.continue();

      assert.ok(didCancel(host.get('task.last.error')));
      assert.ok(host.get('subtask.last.isSuccessful'));
    });

    test('milestone cancellation', async function(assert) {
      let host = TaskHost.create();
      host.get('task').perform();

      let two = await advanceTo('two');
      assert.ok(host.get('task.isRunning'));
      assert.ok(host.get('subtask.isRunning'));

      run(() => two.cancel());
      assert.ok(didCancel(host.get('task.last.error')));
      assert.ok(didCancel(host.get('subtask.last.error')));
    });

    test('milestone cancellation outside a task', async function(assert) {
      let program = async () => {
        try {
          await milestone('one');
        } catch (error) {
          return error;
        }
      };

      advanceTo('one').andCancel();
      assert.ok(didCancel(await program()));
    });
  } else {
    test('a useful error is given when trying to cancel without ember-concurrency', async function(assert) {
      let program = async () => await milestone('one');

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
