import { activateMilestones, advanceTo } from 'ember-milestones';
import { module, test } from 'qunit';
import sinon from 'sinon';

module('Unit | index', function() {
  test('advanceTo', function(assert) {
    let first = activateMilestones(['one', 'two']);
    let second = activateMilestones(['three']);

    let firstStub = sinon.stub(first, 'advanceTo');
    let secondStub = sinon.stub(second, 'advanceTo');

    advanceTo('one');
    assert.ok(firstStub.calledOnce);
    assert.ok(firstStub.calledWith('one'));

    advanceTo('three');
    assert.ok(secondStub.calledOnce);
    assert.ok(secondStub.calledWith('three'));

    advanceTo('two');
    assert.ok(firstStub.calledTwice);
    assert.ok(firstStub.calledWith('two'));

    assert.throws(() => advanceTo('four'), /isn't currently active/);

    first.deactivateAll();
    second.deactivateAll();
  });
});
