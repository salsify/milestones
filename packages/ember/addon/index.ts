import { defer, reject } from 'rsvp';
import { run } from '@ember/runloop';
import EmberObject from '@ember/object';
import { registerSystem } from '@milestones/core';

declare const requirejs: {
  (module: string): any; // eslint-disable-line
  has(module: string): boolean;
};

registerSystem({ run, defer });

if (requirejs.has('ember-concurrency')) {
  const getRunningInstance = requirejs('ember-concurrency/-task-instance').getRunningInstance;
  const taskMacro = requirejs('ember-concurrency').task;
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

  registerSystem({
    defer() {
      let { resolve, promise } = defer();
      let obj = TaskHost.create();
      let task = obj.get('milestoneTask');
      let dfd = {
        promise: (getRunningInstance() ? task.linked() : task).perform(promise),
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
    },
  });
}
