import { describe, test, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import { defer, run, assert, Deferred } from '../src/-private/sys';
import {
  registerSystem,
  resetSystem,
  deactivateAllMilestones,
  activateMilestones,
  advanceTo,
  milestone,
} from '../src/index';

describe('System Hooks', () => {
  afterEach(() => {
    resetSystem();
    deactivateAllMilestones();
  });

  describe('registerSystem and resetSystem', () => {
    function errorThunk(message: string): () => never {
      return () => {
        throw new Error(message);
      };
    }

    test('defer', () => {
      registerSystem({ defer: errorThunk('defer') });
      expect(() => defer()).to.throw('defer');
      resetSystem();
      defer();
    });

    test('run', () => {
      registerSystem({ run: errorThunk('run') });
      expect(() => run(() => {})).to.throw('run');
      resetSystem();
      run(() => {});
    });

    test('assert', () => {
      registerSystem({ assert: errorThunk('assert') });
      expect(() => assert(true, 'ok')).to.throw('assert');
      resetSystem();
      assert(true, 'ok');
    });
  });

  describe('wrap', () => {
    let isWrapped = false;
    beforeEach(() => {
      isWrapped = false;
      registerSystem({
        run<T>(f: () => T): T {
          isWrapped = true;
          let result = f();
          isWrapped = false;
          return result;
        },
      });
    });

    test('wraps continued milestone callbacks with the configured wrapper', async () => {
      let program = async (): Promise<string> => {
        return await milestone('hi', async () => {
          expect(isWrapped).to.equal(true);
          return 'done';
        });
      };

      activateMilestones(['hi']);
      advanceTo('hi').andContinue();

      expect(isWrapped).to.equal(false);
      expect(await program()).to.equal('done');
      expect(isWrapped).to.equal(false);
    });
  });

  describe('defer', () => {
    let Cancelation = Symbol();

    beforeEach(() => {
      registerSystem({
        defer<T>() {
          let deferred = ({} as unknown) as Deferred<T>;
          deferred.promise = new Promise((resolve, reject) => {
            deferred.resolve = resolve;
            deferred.reject = reject;
            deferred.cancel = () => reject(Cancelation);
          });
          return deferred;
        },
      });
    });

    test('allows for a custom cancelation implementation', async () => {
      let program = async (): Promise<string> => {
        return await milestone('hi', async () => 'ok');
      };

      activateMilestones(['hi']);
      advanceTo('hi').andCancel();

      try {
        await program();
        expect.fail();
      } catch (error) {
        expect(error).to.equal(Cancelation);
      }
    });
  });
});
