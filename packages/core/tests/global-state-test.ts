import { describe, test } from 'mocha';
import { expect } from 'chai';
import { getOrInit, clear } from '../src/-private/global';
import sinon from 'sinon';

describe('Global State', () => {
  let sandbox = sinon.createSandbox();
  beforeEach(() => {
    sandbox.stub(console, 'warn');
  });

  afterEach(() => {
    sandbox.restore();
    clear();
  });

  test('initializing new state', () => {
    let value = Symbol();
    let first = getOrInit('symbol', () => value);
    let second = getOrInit('symbol', () => Symbol());

    expect(first).to.equal(value);
    expect(second).to.equal(value);
  });
});
