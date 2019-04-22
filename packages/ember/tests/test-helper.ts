import Application from 'dummy/app';
import config from 'dummy/config/environment';
import { setApplication } from '@ember/test-helpers';
import { start } from 'ember-qunit';

// The green background from the dummy app makes navigating tests hard
document.body.setAttribute('style', 'background-color: white !important');

setApplication(Application.create(config.APP));

start();
