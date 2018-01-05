import { module, test } from 'qunit';
import { Promise, defer } from 'rsvp';
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
    this.milestones.deactivate();

    let { first, second } = await this.program();
    assert.equal(this.location, 'two-completed');
    assert.equal(first, 1);
    assert.equal(second, 2);
  });

  test('skipping a milestone', async function(assert) {
    let programPromise = this.program();

    await this.milestones.advanceTo('two').andPause();
    assert.equal(this.location, 'one-completed');

    this.milestones.unpause().andContinue();
    assert.equal(this.location, 'two-started');

    let { first, second } = await programPromise;
    assert.equal(this.location, 'two-completed');
    assert.equal(first, 1);
    assert.equal(second, 2);
  });

  test('continuing from a milestone resolves after its callback does', async function(assert) {
    let resolved = false;
    let deferred = defer();
    let program = async () => {
      this.location = 'before';
      let result = await milestone('one', () => {
        this.location = 'during';
        return deferred.promise;
      });
      this.location = 'after';
      return result;
    };

    let programPromise = program();

    this.milestones.advanceTo('one').andContinue().then(() => resolved = true);

    assert.equal(this.location, 'during');
    assert.notOk(resolved);

    // Allow anything that's gonna settle to settle
    await next();

    // Ensure the milestone callback was run but the `.andContinue()` promise hasn't resolved
    assert.equal(this.location, 'during');
    assert.notOk(resolved);

    deferred.resolve('ok');

    await next();

    assert.equal(this.location, 'after');
    assert.ok(resolved);

    assert.equal(await programPromise, 'ok');
  });

  test('advancing to an already-waiting milestone', async function(assert) {
    let programPromise = this.program();

    assert.equal(this.location, 'before');

    await this.milestones.advanceTo('one').andPause();

    assert.equal(this.location, 'before');

    this.milestones.deactivate();

    let { first, second } = await programPromise;
    assert.equal(first, 1);
    assert.equal(second, 2);
  });

  test('advancing to a not-yet-waiting milestone', async function(assert) {
    let advancePromise = this.milestones.advanceTo('two').andPause();

    this.program();
    assert.equal(this.location, 'one-started');

    await advancePromise;
    assert.equal(this.location, 'one-completed');
  });

  test('advancing while paused at a previous milestone', async function(assert) {
    let programPromise = this.program();

    await this.milestones.advanceTo('one').andPause();
    assert.equal(this.location, 'before');

    await this.milestones.advanceTo('two').andPause();
    assert.equal(this.location, 'one-completed');

    this.milestones.deactivate();

    assert.deepEqual(await programPromise, { first: 1, second: 2 });
  });

  test('stubbing a return value', async function(assert) {
    this.milestones
      .advanceTo('one').andReturn(111)
      .advanceTo('two').andReturn(222);

    let { first, second } = await this.program();
    assert.equal(first, 111);
    assert.equal(second, 222);
  });

  test('throwing an exception', async function(assert) {
    let boom = new Error('boom!');

    this.milestones.advanceTo('one').andThrow(boom);

    try {
      await this.program();
      assert.ok(false, 'Should have thrown an error');
    } catch (error) {
      assert.equal(error, boom);
    }
  });

  test('stepping through each location', async function(assert) {
    let programPromise = this.program();

    await this.milestones.advanceTo('one').andPause();
    assert.equal(this.location, 'before');

    this.milestones.unpause().andContinue();
    assert.equal(this.location, 'one-started');

    await this.milestones.advanceTo('two').andPause();
    assert.equal(this.location, 'one-completed');

    this.milestones.unpause().andContinue();
    assert.equal(this.location, 'two-started');

    await programPromise;
    assert.equal(this.location, 'two-completed');
  });

  test('immediate vs deferred continuation', async function(assert) {
    let program = async () => {
      this.location = 'before';

      let result = await milestone('one', async () => 'ok');

      this.location = 'between';

      await 1;
      await 2;
      await 3;

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

  function next() {
    return new Promise(resolve => setTimeout(resolve));
  }
});
