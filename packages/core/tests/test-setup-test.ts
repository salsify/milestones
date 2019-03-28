import { describe, test } from 'mocha';
import { expect } from 'chai';
import { setupMilestones } from '../src/index';
import { ACTIVE_COORDINATORS } from '../src/-private/milestone-coordinator';

describe('Test Setup', () => {
  describe('activating milestones', () => {
    setupMilestones(['one']);
    setupMilestones(['two', 'three']);

    afterEach(() => {
      expect(Object.keys(ACTIVE_COORDINATORS)).to.deep.equal([]);
    });

    test('milestones are turned on', async () => {
      expect(Object.keys(ACTIVE_COORDINATORS)).to.deep.equal(['one', 'two', 'three']);
      expect(ACTIVE_COORDINATORS.one).not.to.equal(ACTIVE_COORDINATORS.two);
      expect(ACTIVE_COORDINATORS.two).to.equal(ACTIVE_COORDINATORS.three);
    });
  });

  describe('with explicit hooks', () => {
    let before = false;
    let after = false;
    setupMilestones(
      {
        beforeEach(f) {
          before = true;
          beforeEach(f);
        },
        afterEach(f) {
          after = true;
          afterEach(f);
        },
      },
      ['one'],
    );

    afterEach(() => {
      expect(after).to.be.true;
      expect(Object.keys(ACTIVE_COORDINATORS)).to.deep.equal([]);
    });

    test('the given hooks are invoked', async () => {
      expect(before).to.be.true;
      expect(Object.keys(ACTIVE_COORDINATORS)).to.deep.equal(['one']);
    });
  });
});
