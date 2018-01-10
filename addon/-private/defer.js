import require from 'require';
import EmberObject from '@ember/object';
import { run } from '@ember/runloop';
import {
  defer as rsvpDefer,
  reject as rsvpReject
} from 'rsvp';

export let defer;

if (require.has('ember-concurrency')) {
  const { task } = require('ember-concurrency');
  const { getRunningInstance } = require('ember-concurrency/-task-instance');
  const Obj = EmberObject.extend({
    started: false,
    milestoneTask: task(function(promise) {
      return {
        next: () => {
          if (!this.started) {
            this.started = true;
            return { value: promise, done: false };
          } else {
            return { value: this.child, done: true };
          }
        }
      };
    })
  });

  defer = function(label) {
    let { resolve, promise } = rsvpDefer(label);
    let obj = Obj.create();
    let task = obj.get('milestoneTask');
    let dfd = {
      promise: run(() => (getRunningInstance() ? task.linked() : task).perform(promise)),
      cancel(reason) {
        resolve();
        dfd.promise.cancel(reason);
      },
      resolve(value) {
        obj.child = value;
        resolve();
      },
      reject(error) {
        obj.child = rsvpReject(error);
        resolve();
      }
    };

    return dfd;
  };
} else {
  defer = function(label) {
    let dfd = rsvpDefer(label);

    dfd.cancel = () => {
      throw new Error(`Milestones aren't cancelable unless ember-concurrency is installed.`);
    };

    return dfd;
  };
}
