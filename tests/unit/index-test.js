import { module, test } from 'qunit';
import sinon from 'sinon';
import { advanceTo, activateMilestones } from 'ember-milestones';

module('Unit | index', function() {
  test('advanceTo', function(assert) {
    let first = activateMilestones(['one', 'two']);
    let second = activateMilestones(['three']);

    sinon.stub(first, 'advanceTo');
    sinon.stub(second, 'advanceTo');

    advanceTo('one');
    assert.ok(first.advanceTo.calledOnce);
    assert.ok(first.advanceTo.calledWith('one'));

    advanceTo('three');
    assert.ok(second.advanceTo.calledOnce);
    assert.ok(second.advanceTo.calledWith('three'));

    advanceTo('two');
    assert.ok(first.advanceTo.calledTwice);
    assert.ok(first.advanceTo.calledWith('two'));

    assert.throws(() => advanceTo('four'), /isn't currently active/);

    first.deactivateAll();
    second.deactivateAll();
  });
});
