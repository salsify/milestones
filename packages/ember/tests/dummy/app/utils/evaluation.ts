import { PausePoint, EvaluationThread, EvaluationFunction, CancelEvaluation } from './evaluation/evaluation-thread';
import { rewriteImports } from './evaluation/rewrite-imports';
import { annotateAsyncCode } from './evaluation/annotate-code';
import { stripIndent } from 'common-tags';
import RSVP from 'rsvp';

export { PausePoint };

type StateListener = (pauses: Record<string, PausePoint[]>) => void;
type ErrorListener = (key: string, error: { message?: string }) => void;

/**
 * Represents a full evaluation, composed of one or more interleaving
 * 'threads', that can be advanced step by step. Accepts a `preamble`
 * string, a record of named `blocks` representing the individual threads
 * to be executed, and an `importFn` that dictates how `import` statements
 * will resolve.
 *
 * Given a block like the this:
 *
 * ```ts
 * async function sleep(ms) {
 *   log('about to sleep');
 *   await new Promise(r => setTimeout(r, ms));
 *   log('done sleeping');
 * }
 *
 * await sleep(1000);
 * await sleep(1000);
 * ```
 *
 * It will be transformed into something like this:
 *
 * ```ts
 * async (__line__, __async__, __spawn__) => {
 *   async function sleep(ms) {
 *     return __spawn__(2, async (__line__, __async__, __spawn__) => {
 *       await __line__(2);
 *       log('about to sleep');
 *       await __line__(3);
 *       await __async__(3, new Promise(r => setTimeout(r, ms)));
 *       await __line__(4);
 *       log('done sleeping');
 *     });
 *   }
 *
 *   await __line__(7);
 *   await __async__(7, sleep(1000));
 *   await __line__(8);
 *   await __async__(8, sleep(1000));
 * }
 * ```
 *
 * The `Evaluation` provides values for `__line__`, `__async__` and `__spawn__`,
 * which are used to track progress through the block as it evaluates and when
 * it spins off additional asynchronous logic.
 *
 * See the Playground section of the docs app for a demonstration of how
 * these pieces fit together.
 */
export class Evaluation {
  private stateListeners: StateListener[] = [];
  private errorListeners: ErrorListener[] = [];
  private msPerStep?: number;
  private stepTimeout?: ReturnType<typeof setTimeout>;
  private threads = new Map<string, EvaluationThread[]>();
  private readyThreads: EvaluationThread[] = [];
  private readyThreadDeferred?: RSVP.Deferred<EvaluationThread>;

  public constructor(preamble: string, blocks: Record<string, string>, importFn: (path: string) => unknown) {
    let source = this.buildSource(preamble, blocks);
    let fns: Record<string, EvaluationFunction> = eval(source)(importFn);

    for (let key of Object.keys(fns)) {
      this.spawn(key, 0, fns[key]).catch(() => {});
    }
  }

  public async step(maxWaitMs?: number): Promise<void> {
    while (!this.isComplete()) {
      let thread = await this.nextReadyThread(maxWaitMs);

      // If no thread was ready within the given timeout, just be done.
      if (!thread) {
        break;
      }

      let wasAsync = !thread.canStepSync();

      await thread.step();

      if (thread.canStepSync()) {
        this.readyThreads.unshift(thread);
      }

      // If we performed an async step, or we moved from one sync step
      // to the next, we've made meaningful progress and can be done
      if (wasAsync || thread.canStepSync()) {
        break;
      }
    }

    this.emitStateUpdate();
    this.scheduleStep(maxWaitMs);
  }

  public enableAutoAdvance(msPerStep: number): void {
    this.msPerStep = msPerStep;
  }

  public disableAutoAdvance(): void {
    this.msPerStep = undefined;
  }

  public isComplete(): boolean {
    return [...this.allThreads()].every(thread => thread.isComplete());
  }

  public cancel(): void {
    for (let thread of this.allThreads()) {
      thread.cancel();
    }

    this.emitStateUpdate();

    if (this.stepTimeout) {
      clearTimeout(this.stepTimeout);
    }
  }

  public onError(listener: ErrorListener): void {
    this.errorListeners.push(listener);
  }

  public onStateChange(listener: StateListener): void {
    this.stateListeners.push(listener);
  }

  private buildSource(preamble: string, blocks: Record<string, string>): string {
    let keys = Object.keys(blocks);
    let indent = `\n        `;
    return rewriteImports(stripIndent`
      ${preamble.replace(/\n/g, indent)}
      return {
        ${keys
          .map(key => `${JSON.stringify(key)}: ${annotateAsyncCode(blocks[key])}`)
          .join(',\n')
          .replace(/\n/g, `${indent}  `)}
        };
    `);
  }

  private emitStateUpdate(): void {
    let state: Record<string, PausePoint[]> = {};
    for (let [key, threads] of this.threads.entries()) {
      let pauses: PausePoint[] = (state[key] = []);
      for (let thread of threads) {
        let pause = thread.getPausePoint();
        if (pause) {
          pauses.push(pause);
        }
      }
    }

    for (let listener of this.stateListeners) {
      listener(state);
    }
  }

  private scheduleStep(maxWaitMs?: number): void {
    if (typeof this.msPerStep === 'number' && !this.stepTimeout) {
      this.stepTimeout = setTimeout(() => {
        this.stepTimeout = undefined;
        if (typeof this.msPerStep === 'number') {
          this.step(maxWaitMs);
        }
      }, this.msPerStep);
    }
  }

  private spawn(key: string, line: number, fn: EvaluationFunction): Promise<unknown> {
    let ready = (): void => this.threadBecameReady(thread);
    let thread = new EvaluationThread(fn, (line, child) => this.spawn(key, line, child), ready, line);

    this.registerThread(key, thread);
    this.handleErrors(key, thread);
    this.readyThreads.push(thread);

    return thread.completionValue();
  }

  private *allThreads(): IterableIterator<EvaluationThread> {
    for (let threads of this.threads.values()) {
      yield* threads;
    }
  }

  private registerThread(key: string, thread: EvaluationThread): void {
    let siblings = this.threads.get(key);
    if (!siblings) {
      this.threads.set(key, (siblings = []));
    }
    siblings.push(thread);
  }

  private handleErrors(key: string, thread: EvaluationThread): void {
    thread.completionValue().catch(error => {
      if (error instanceof CancelEvaluation) {
        return;
      }

      for (let listener of this.errorListeners) {
        listener(key, error);
      }

      for (let thread of this.allThreads()) {
        thread.cancel();
      }
    });
  }

  private async nextReadyThread(maxWaitMs?: number): Promise<EvaluationThread | undefined> {
    if (this.readyThreads.length) {
      return this.readyThreads.shift()!;
    }

    if (!this.readyThreadDeferred) {
      this.readyThreadDeferred = RSVP.defer();
    }

    let promises: Promise<EvaluationThread | undefined>[] = [this.readyThreadDeferred.promise];
    if (maxWaitMs) {
      promises.push(
        new Promise<undefined>(resolve =>
          setTimeout(() => {
            this.readyThreadDeferred = undefined;
            resolve();
          }, maxWaitMs),
        ),
      );
    }
    return Promise.race(promises);
  }

  private threadBecameReady(thread: EvaluationThread): void {
    if (this.readyThreadDeferred) {
      this.readyThreadDeferred.resolve(thread);
      this.readyThreadDeferred = undefined;
    } else {
      this.readyThreads.push(thread);
    }
  }
}
