import { visit } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import { module, test } from 'qunit';
import Env from 'dummy/config/environment';
import Pretender from 'pretender';
import { deactivateAllMilestones, activateMilestones } from '@milestones/core';
import { StepComplete } from 'dummy/utils/evaluation';

interface DocsRoutesService {
  routeUrls: string[];
}

if (!Env.STRIP_MILESTONES) {
  const MAX_STEPS = 50;
  const URLS = [
    '/',
    '/docs',
    '/docs/interacting-with-milestones',
    '/docs/milestone-keys',
    '/docs/ember',
    '/docs/the-playground',
  ];

  module('Acceptance | playgrounds', function(hooks) {
    setupApplicationTest(hooks);

    hooks.afterEach(() => deactivateAllMilestones());

    let pretender: Pretender;
    hooks.beforeEach(function() {
      pretender = new Pretender(function() {
        this.get('https://httpbin.org/get', req => {
          let args = (req as { params: unknown }).params;
          return [200, {}, JSON.stringify({ args })];
        });

        // @ts-ignore
        this.get('/docs/*', this.passthrough);
        this.get('/versions.json', () => [404, {}, '']);
      });
    });

    hooks.afterEach(function() {
      pretender.shutdown();
    });

    test('every docs page with playgrounds is tested', async function(assert) {
      await visit('/docs');

      let docsRoutes = this.owner.lookup('service:docs-routes') as DocsRoutesService;
      for (let url of docsRoutes.routeUrls) {
        if (URLS.includes(url)) continue;

        await visit(url);

        assert.notOk(this.element.querySelector('[data-test="playground"]'), `${url} has no playgrounds on it`);
      }
    });

    for (let url of URLS) {
      test(`every playground on ${url} runs to completion`, async function(assert) {
        await visit(url);

        playgrounds: for (let [i, playground] of this.element.querySelectorAll('[data-test="playground"]').entries()) {
          let stepButton = playground.querySelector('[data-test="step"]')! as HTMLButtonElement;
          let resetButton = playground.querySelector('[data-test="reset"]')! as HTMLButtonElement;
          let output = playground.querySelector('[data-test="output"]')! as HTMLDivElement;

          for (let step = 0; step < MAX_STEPS; step++) {
            stepButton.click();
            let coordinator = activateMilestones([StepComplete]);
            await coordinator.advanceTo(StepComplete);
            coordinator.deactivateAll();

            if (step === 0) {
              assert.notOk(resetButton.disabled, `Playground ${i} on doesn't immediately error`);
            }

            if (resetButton.disabled) {
              assert.notOk(output.innerText.includes('Uncaught error'), `Playground ${i} on completes without error`);
              continue playgrounds;
            }
          }

          assert.ok(false, `Playground ${i} completes in under ${MAX_STEPS} steps`);
        }
      });
    }
  });
}
