import { module, test } from 'qunit';
import { milestone, advanceTo, setupMilestones, MilestoneKey } from '@milestones/core';
import EmberObject from '@ember/object';
import Env from 'dummy/config/environment';

// @ts-ignore
import { task, race, didCancel } from 'ember-concurrency';
import { defer } from 'rsvp';

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

    test("throwing an error doesn't fail the test", async function(assert) {
      class Host extends EmberObject.extend({
        task: task(function*(this: Host) {
          try {
            return yield milestone('one', async () => 'bad');
          } catch (error) {
            return error.message;
          }
        }),
      }) {}

      let object = Host.create();
      let taskPromise = object.task.perform();

      await advanceTo('one').andThrow(new Error('ok'));

      assert.equal(await taskPromise, 'ok');
    });

    test('wrapping a task body in a milestone', async function(assert) {
      class Host extends EmberObject.extend({
        outer: task(function*(this: Host) {
          try {
            return yield this.inner.perform();
          } catch (error) {
            return error.message;
          }
        }),

        inner: task(function*() {
          yield Promise.reject(new Error('bad'));
          return 'bad';
        }).milestone('one'),
      }) {}

      let object = Host.create();
      let taskPromise = object.outer.perform();

      await advanceTo('one').andThrow(new Error('boom'));

      assert.equal(await taskPromise, 'boom');
    });

    test('wrapping a task body in a milestone and canceling', async function(assert) {
      class Host extends EmberObject.extend({
        outer: task(function*(this: Host) {
          return yield this.inner.perform();
        }),

        inner: task(function*() {
          yield Promise.reject(new Error('bad'));
          return 'bad';
        }).milestone('one'),
      }) {}

      let object = Host.create();
      let taskPromise = object.outer.perform();

      await advanceTo('one').andCancel();

      assert.equal(await taskPromise.catch(e => didCancel(e)), true);
      assert.equal(object.outer.lastCanceled, object.outer.last);
      assert.equal(object.inner.lastCanceled, object.inner.last);
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
