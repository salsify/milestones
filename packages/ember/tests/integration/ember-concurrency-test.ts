import { module, test } from 'qunit';
import { milestone, advanceTo, setupMilestones } from '@milestones/core';
import EmberObject from '@ember/object';
import Env from 'dummy/config/environment';

// @ts-ignore
import { task, didCancel } from 'ember-concurrency';

if (!Env.STRIP_MILESTONES) {
  module('Integration | ember-concurrency', function(hooks) {
    setupMilestones(hooks, ['one']);

    test('canceled milestones behave like canceled tasks', async function(assert) {
      class Host extends EmberObject.extend({
        task: task(function*(this: Host) {
          yield milestone('one');
        }),
      }) {}

      let object = Host.create();
      let taskPromise = object.task.perform();

      await advanceTo('one').andCancel();

      assert.equal(await taskPromise.catch(didCancel), true);
      assert.equal(object.task.lastCanceled, object.task.last);
      assert.ok(object.task.isIdle);
    });

    module('cancelation propagation', function() {
      class Host extends EmberObject.extend({
        outer: task(function*(this: Host) {
          yield milestone('one', () => this.inner.perform());
        }),

        inner: task(function*(this: Host) {
          yield new Promise(() => {});
        }),
      }) {}

      test('propagates downwards', async function(assert) {
        let object = Host.create();
        let taskPromise = object.outer.perform();

        let handle = await advanceTo('one');
        handle.continue();

        object.outer.last.cancel();

        assert.equal(await taskPromise.catch(didCancel), true);
        assert.equal(object.outer.lastCanceled, object.outer.last);
        assert.equal(object.inner.lastCanceled, object.inner.last);
        assert.ok(object.outer.isIdle);
        assert.ok(object.inner.isIdle);
      });

      test('propagates upwards', async function(assert) {
        let object = Host.create();
        let taskPromise = object.outer.perform();

        let handle = await advanceTo('one');
        handle.continue();

        object.inner.last.cancel();

        assert.equal(await taskPromise.catch(didCancel), true);
        assert.equal(object.outer.lastCanceled, object.outer.last);
        assert.equal(object.inner.lastCanceled, object.inner.last);
        assert.ok(object.outer.isIdle);
        assert.ok(object.inner.isIdle);
      });
    });
  });
}
