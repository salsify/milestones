import Component from '@ember/component';
import { A } from '@ember/array';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { Evaluation } from 'dummy/utils/evaluation';
import EvaluatorService from 'dummy/services/evaluator';
import { PausePoint } from 'dummy/utils/evaluation';
import { CodeEditorAPI } from '../code-editor/component';
import Config from 'dummy/config/environment';

// Ensure chai is available for import in the playground
import 'chai';

const MAX_STEP_WAIT = 300;

/**
 * Sets up a pre-populated playground demonstrating some aspect of how
 * milestones work. See the Playground page of the docs app for more
 * details.
 *
 * ```hbs
 * <MilestonesPlayground as |pg|>
 *   <pg.preamble>
 *     // Setup code goes here
 *   </pg.preamble>
 *
 *   <pg.editor @title='Test Code'>
 *     // Sample test code goes here
 *   </pg.editor>
 *
 *   <pg.editor @title='App Code'>
 *     // Sample application code goes here
 *   </pg.editor>
 * </MilestonesPlayground>
 * ```
 */
export default class MilestonesPlaygroundComponent extends Component {
  @service private evaluator!: EvaluatorService;

  public tagName = '';
  public state: 'idle' | 'running' | 'paused' = 'idle';
  public logLines = A();
  public lines = 10;

  public playSpeed = 50;
  public showPreamble = false;
  public showConsole = false;
  public showDOM = false;

  protected editors: Record<string, CodeEditorAPI> = {};
  protected domElement?: HTMLDivElement;

  private evaluation?: Evaluation;
  private preambleEditor?: CodeEditorAPI;

  @action
  protected play(): void {
    if (this.state === 'idle') {
      this.startEvaluation();
    } else if (this.evaluation) {
      this.evaluation.enableAutoAdvance(this.msPerStep);
      this.evaluation.step(MAX_STEP_WAIT);
    }

    this.set('state', 'running');
  }

  @action
  protected pause(): void {
    if (this.evaluation) {
      this.set('state', 'paused');
      this.evaluation.disableAutoAdvance();
    }
  }

  @action
  protected step(): void {
    if (this.state === 'idle') {
      this.startEvaluation();
    } else if (this.evaluation) {
      this.evaluation.step(MAX_STEP_WAIT);
    }

    this.evaluation!.disableAutoAdvance();
    this.set('state', 'paused');
  }

  @action
  protected stop(): void {
    this.set('state', 'idle');
    this.clearOutput();

    if (this.evaluation) {
      this.evaluation.cancel();
    }
  }

  @action
  protected editorWasAdded(key: string, api: CodeEditorAPI): void {
    if (this.editors[key]) {
      throw new Error(`Duplicate editor key: '${key}'`);
    }
    this.editors[key] = api;
  }

  @action
  protected preambleWasAdded(_key: string, api: CodeEditorAPI): void {
    this.preambleEditor = api;
  }

  @action
  protected codeDidChange(): void {
    this.stop();
  }

  @action
  protected speedChanged(speed: string): void {
    let parsed = parseInt(speed);
    this.set('playSpeed', parsed);

    if (this.evaluation) {
      this.evaluation.enableAutoAdvance(parsed);
    }
  }

  private clearOutput(): void {
    this.set('logLines', A());

    if (this.domElement) {
      this.domElement.innerText = '';
    }

    for (let key of Object.keys(this.editors)) {
      this.editors[key].setError(false);
    }
  }

  private get msPerStep(): number {
    // 0 -> 2000ms per frame, 100 -> 0
    return (100 - this.playSpeed) * 20;
  }

  private startEvaluation(): void {
    this.clearOutput();

    try {
      this.evaluation = this.buildEvaluation();
      this.evaluation.onError((key, error) => this.editorDidError(key, error));
      this.evaluation.onStateChange(pauses => this.stateDidChange(pauses));
      this.evaluation.enableAutoAdvance(this.msPerStep);
      this.evaluation.step(MAX_STEP_WAIT);
    } catch (error) {
      this.logLines.pushObject(`Uncaught error: ${error.message || error}`);
    }
  }

  private buildEvaluation(): Evaluation {
    let element = document.createElement('div');
    let preamble = this.buildPreamble();
    let sources = this.buildSources();
    let playgroundModule: Record<string, unknown> = {
      element,
      log: makeLogger(this.logLines),
    };

    if (this.domElement) {
      this.domElement.appendChild(element);
    }

    return this.evaluator.evaluate(preamble, sources, makeRequireFn(playgroundModule));
  }

  private stateDidChange(pauses: Record<string, PausePoint[]>): void {
    if (this.isDestroyed) return;

    if (Object.keys(pauses).every(key => pauses[key].length === 0)) {
      this.set('state', 'idle');
    }

    for (let [key, pausePoints] of Object.entries(pauses)) {
      this.editors[key].setActiveLines(pausePoints);
    }
  }

  private editorDidError(key: string, error: { message?: string }): void {
    if (this.isDestroyed) return;

    this.editors[key].setError(true);
    this.logLines.pushObject(`Uncaught error: ${error.message || error}`);
  }

  private buildPreamble(): string {
    if (this.preambleEditor) {
      return this.preambleEditor.getCode();
    }

    return '';
  }

  private buildSources(): Record<string, string> {
    let sources: Record<string, string> = {};
    for (let key of Object.keys(this.editors)) {
      sources[key] = this.editors[key].getCode();
    }
    return sources;
  }
}

function makeLogger(logLines: ReturnType<typeof A>): (...params: unknown[]) => void {
  return (...params) => {
    logLines.pushObject(params.map(param => (typeof param === 'string' ? param : JSON.stringify(param))).join(' '));

    if (Config.environment !== 'test') {
      window.console.log(...params);
    }
  };
}

function makeRequireFn(playgroundModule: Record<string, unknown>): (path: string) => unknown {
  return (path: string): unknown => {
    if (path === '@milestones/playground') {
      return playgroundModule;
    } else {
      try {
        // @ts-ignore
        return window.require(path);
      } catch {
        return {};
      }
    }
  };
}
