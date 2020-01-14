import { defer, reject } from 'rsvp';
import { run } from '@ember/runloop';
import { registerSystem, MilestoneKey, MilestoneOptions, milestone } from '@milestones/core';
import { Deferred } from '../../core/src/-private/sys';
import EmberObject from '@ember/object';

declare const require: {
  (module: string): any; // eslint-disable-line
  has(module: string): boolean;
};

registerSystem({ run, defer });

if (require.has('ember-concurrency')) {
  // const { didCancel } = require('ember-concurrency');
  // const { yieldableSymbol, YIELDABLE_CONTINUE, YIELDABLE_CANCEL, YIELDABLE_THROW } = require('ember-concurrency/utils');

  // type PromiseCallback = ConstructorParameters<typeof Promise>[0];
  // class MilestoneYieldable<T> extends Promise<T> {
  //   public _resolve!: Parameters<PromiseCallback>[0];
  //   public _reject!: Parameters<PromiseCallback>[1];

  //   public constructor(f: PromiseCallback) {
  //     let resolve!: Parameters<PromiseCallback>[0];
  //     let reject!: Parameters<PromiseCallback>[0];
  //     super((res, rej) => {
  //       resolve = res;
  //       reject = rej;
  //       f(res, rej);
  //     });
  //     this._resolve = resolve;
  //     this._reject = reject;
  //     this['__ec_cancel__'] = this.__ec_cancel__.bind(this);
  //   }

  //   public [yieldableSymbol](taskInstance: any, resumeIndex: number): void {
  //     this.then(
  //       value => {
  //         debugger;
  //         taskInstance.proceed(resumeIndex, YIELDABLE_CONTINUE, value);
  //       },
  //       error => {
  //         debugger;
  //         if (didCancel(error)) {
  //           taskInstance.proceed(resumeIndex, YIELDABLE_CANCEL);
  //         } else {
  //           taskInstance.proceed(resumeIndex, YIELDABLE_THROW, error);
  //         }
  //       },
  //     );
  //   }

  //   public ['__ec_cancel__'](): void {
  //     debugger;
  //     this._reject(
  //       Object.assign(new Error('Milestone canceled'), {
  //         name: 'TaskCancelation',
  //       }),
  //     );
  //   }
  // }

  // registerSystem({
  //   defer: <T>(): Deferred<T> => {
  //     let promise = new MilestoneYieldable<T>(() => {});
  //     return {
  //       promise,
  //       resolve: value => promise._resolve(value),
  //       reject: error => promise._reject(error),
  //       cancel: () => promise.__ec_cancel__(),
  //     };
  //   },
  // });

  let wrappingTask = false;
  const shouldLink = (): boolean => false; //!wrappingTask && !!getRunningInstance();

  const getRunningInstance = require('ember-concurrency/-task-instance').getRunningInstance;
  const taskMacro = require('ember-concurrency').task;
  class TaskHost extends EmberObject.extend({
    started: false,
    realPromise: null as unknown,
    milestoneTask: taskMacro(function(this: TaskHost, promise: Promise<unknown>) {
      return {
        next: () => {
          if (!this.started) {
            this.started = true;
            return { value: promise, done: false };
          } else {
            return { value: this.realPromise, done: true };
          }
        },
      };
    }),
  }) {}

  const ecDefer = <T>(): Deferred<T> => {
    let { resolve, promise } = defer();
    let obj = TaskHost.create();
    let task = obj.get('milestoneTask');
    let dfd = {
      promise: (shouldLink() ? task.linked() : task).perform(promise),
      cancel(reason: unknown) {
        resolve();
        dfd.promise.cancel(reason);
      },
      resolve(value: unknown) {
        obj.realPromise = value;
        resolve();
      },
      reject(error: unknown) {
        obj.realPromise = reject(error);
        resolve();
      },
    };

    return dfd;
  };

  registerSystem({ defer: ecDefer });

  const { didCancel } = require('ember-concurrency');
  const { TaskProperty } = require('ember-concurrency/-task-property');
  TaskProperty.prototype.milestone = function(id: MilestoneKey, options?: MilestoneOptions) {
    let { taskFn } = this;
    this.taskFn = function*(this: unknown, ...params: unknown[]) {
      let control = defer<unknown>();
      let { outcome, value } = yield new Promise(resolve => {
        let callback = (): Promise<unknown> => {
          resolve({ outcome: 'continue' });
          return control.promise;
        };

        wrappingTask = true;
        milestone(id, callback, options)
          .then(value => resolve({ outcome: 'return', value }))
          .catch(value => resolve({ outcome: 'throw', value }));
        wrappingTask = false;
      });

      try {
        if (outcome === 'return') {
          return value;
        } else if (outcome === 'throw') {
          if (didCancel(value)) {
            let dfd = ecDefer();
            dfd.cancel!();
            return dfd.promise;
          } else {
            return reject(value);
          }
        }

        let it: IterableIterator<unknown> = taskFn.apply(this, params);
        let yielded = it.next();
        while (!yielded.done) {
          yielded = it.next(yield yielded.value);
        }
        return yield yielded.value;
      } finally {
        control.resolve();
      }
    };
    return this;
  };
}
