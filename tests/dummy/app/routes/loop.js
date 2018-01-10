import Route from '@ember/routing/route';
import { task, timeout } from 'ember-concurrency';
import { milestone } from 'ember-milestones';

export default Route.extend({
  setupController(controller) {
    this._super(...arguments);
    this.get('tick').perform(controller);
  },

  tick: task(function*(controller) {
    controller.set('value', -1);
    while (true) {
      yield milestone('route:tick#timer', () => timeout(1000));
      controller.incrementProperty('value');
    }
  })
});
