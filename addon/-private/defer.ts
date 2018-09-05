import EmberObject from '@ember/object';
import { run } from '@ember/runloop';
import { CancelableDeferred } from 'ember-milestones';
import require from 'require';
import {
  defer as rsvpDefer,
  reject as rsvpReject,
} from 'rsvp';

/** @hide */
export let defer: (label?: string) => CancelableDeferred;

if (require.has('ember-concurrency')) {
  const taskMacro = require('ember-concurrency').task;
  const { getRunningInstance } = require('ember-concurrency/-task-instance');
  class TaskHost extends EmberObject.extend({
    started: false,
    realPromise: null as any,
    milestoneTask: taskMacro(function(this: TaskHost, promise: Promise<any>) {
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

  defer = function(label) {
    let { resolve, promise } = rsvpDefer(label);
    let obj = TaskHost.create();
    let task = obj.get('milestoneTask');
    let dfd = {
      promise: run(() => (getRunningInstance() ? task.linked() : task).perform(promise)),
      cancel(reason: any) {
        resolve();
        dfd.promise.cancel(reason);
      },
      resolve(value: any) {
        obj.realPromise = value;
        resolve();
      },
      reject(error: any) {
        obj.realPromise = rsvpReject(error);
        resolve();
      },
    };

    return dfd;
  };
} else {
  defer = function(label) {
    let dfd: any = rsvpDefer(label);

    dfd.cancel = () => {
      throw new Error(`Milestones aren't cancelable unless ember-concurrency is installed.`);
    };

    return dfd;
  };
}
