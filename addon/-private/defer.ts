import EmberObject from '@ember/object';
import { run } from '@ember/runloop';
import { CancelableDeferred } from 'ember-milestones/interfaces';
import require from 'require';
import {
  defer as rsvpDefer,
  reject as rsvpReject,
} from 'rsvp';

export let defer: (label?: string) => CancelableDeferred;

if (require.has('ember-concurrency')) {
  interface MilestoneTaskHost {
    started: boolean;
    child?: any;
  }

  const taskMacro = require('ember-concurrency').task;
  const { getRunningInstance } = require('ember-concurrency/-task-instance');
  const taskHost = EmberObject.extend({
    started: false,
    child: null as any,
    milestoneTask: taskMacro(function(this: MilestoneTaskHost, promise: Promise<any>) {
      return {
        next: () => {
          if (!this.started) {
            this.started = true;
            return { value: promise, done: false };
          } else {
            return { value: this.child, done: true };
          }
        },
      };
    }),
  });

  defer = function(label) {
    let { resolve, promise } = rsvpDefer(label);
    let obj = taskHost.create();
    let task = obj.get('milestoneTask');
    let dfd = {
      promise: run(() => (getRunningInstance() ? task.linked() : task).perform(promise)),
      cancel(reason: any) {
        resolve();
        dfd.promise.cancel(reason);
      },
      resolve(value: any) {
        obj.child = value;
        resolve();
      },
      reject(error: any) {
        obj.child = rsvpReject(error);
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
