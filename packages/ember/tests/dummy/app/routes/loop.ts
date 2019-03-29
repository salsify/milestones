import Route from '@ember/routing/route';
import { milestone } from '@milestones/core';
// @ts-ignore
import { task, timeout } from 'ember-concurrency';
import Controller from '@ember/controller';

export const TickTimer = Symbol('tick-timer');

export default Route.extend({
  setupController(controller: Controller & { value: number }) {
    this._super(...arguments);
    this.tick.perform(controller);
  },

  tick: task(function*(controller: Controller & { value: number }) {
    controller.set('value', -1);
    while (true) {
      yield milestone(TickTimer, () => timeout(1000));
      controller.incrementProperty('value');
    }
  }),
});
