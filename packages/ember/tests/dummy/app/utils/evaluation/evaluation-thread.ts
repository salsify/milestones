import { MilestoneCoordinator, MilestoneHandle, activateMilestones, milestone, advanceTo } from '@milestones/core';
import RSVP from 'rsvp';

export type LineMarker = (line: number) => PromiseLike<void>;
export type AsyncMarker = (line: number, promise: PromiseLike<unknown>) => PromiseLike<unknown>;
export type SpawnMarker = (line: number, child: EvaluationFunction) => PromiseLike<unknown>;
export type EvaluationFunction = (line: LineMarker, async: AsyncMarker, spawn: SpawnMarker) => PromiseLike<unknown>;

export class CancelEvaluation extends Error {}

export interface PendingMarker {
  async: boolean;
  line: number;
  handle: MilestoneHandle;
}

export interface PausePoint {
  type: 'unstarted' | 'sync' | 'async';
  line: number;
}

/**
 * See the docs for `Evaluation` for details of what's happening here.
 */
export class EvaluationThread {
  private state: 'unstarted' | 'running' | 'completed' = 'unstarted';
  private tag = Symbol('evaluation-marker');
  private completion = RSVP.defer<unknown>();
  private coordinator?: MilestoneCoordinator;
  private pausedAt?: PendingMarker;

  public constructor(
    private fn: EvaluationFunction,
    private spawn: SpawnMarker = async () => {},
    private ready: () => void = () => {},
    private line: number = 1,
  ) {}

  public getPausePoint(): PausePoint | void {
    if (this.state === 'unstarted') {
      return { type: 'async', line: this.line };
    } else if (this.pausedAt) {
      let { async, line } = this.pausedAt;
      return { type: async ? 'async' : 'sync', line };
    }
  }

  public isComplete(): boolean {
    return this.state === 'completed';
  }

  public async completionValue(): Promise<unknown> {
    return this.completion.promise;
  }

  public canStepSync(): boolean {
    return this.state === 'unstarted' || !!(this.pausedAt && !this.pausedAt.async);
  }

  public async step(): Promise<void> {
    if (this.state === 'unstarted') {
      return this.start();
    } else if (this.state === 'running' && this.pausedAt) {
      let { handle } = this.pausedAt;
      this.pausedAt = undefined;

      await handle.continue();
      await this.advance();
    }
  }

  public cancel(): void {
    if (this.pausedAt) {
      this.pausedAt.handle.throw(new CancelEvaluation());
      this.pausedAt = undefined;
    }

    if (this.coordinator) {
      this.coordinator.deactivateAll();
    }

    this.state = 'completed';
  }

  private async start(): Promise<void> {
    this.state = 'running';
    this.coordinator = activateMilestones([this.tag]);
    this.fn(this.markLine.bind(this), this.trackPromise.bind(this), this.spawn.bind(this)).then(
      this.completion.resolve,
      this.completion.reject,
    );

    this.scheduleCleanup();

    await this.advance();
  }

  private async advance(): Promise<void> {
    if (this.state === 'completed') return;

    let handle = await this.awaitMilestoneOrCompletion();
    if (!handle) {
      this.pausedAt = undefined;
      return;
    }

    let line = this.extractLine(handle);
    let async = handle.tags.includes('-async');
    this.pausedAt = { handle, async, line };
  }

  private awaitMilestoneOrCompletion(): Promise<MilestoneHandle | void> {
    return Promise.race([advanceTo(this.tag), this.completion.promise.then(() => {}, () => {})]);
  }

  private async markLine(line: number): Promise<void> {
    return milestone(Symbol(), { tags: [this.tag, `-line:${line}`] });
  }

  private async trackPromise(line: number, promise: PromiseLike<unknown>): Promise<unknown> {
    Promise.resolve(promise)
      .catch(() => {})
      .then(() => this.ready());

    let alreadySettled = await isSettled(promise);
    let result = await milestone(Symbol(), () => promise, { tags: [this.tag, `-line:${line}`, '-async'] });

    if (!alreadySettled) {
      // This is kind of weird, but moving from an async pause back to a sync one once the underlying
      // promise has resolved ends up feeling better when manually stepping and leads to a nice visual
      // continuity as the flow moves from evaluation to evaluation.
      await this.markLine(line);
    }

    return result;
  }

  private extractLine(handle: MilestoneHandle): number {
    let lineTag = handle.tags.find(tag => /^-line:\d+/.test(tag.toString()));
    if (lineTag) {
      return parseInt(lineTag.toString().replace('-line:', ''), 10);
    }
    throw new Error('Unable to extract line number');
  }

  private async scheduleCleanup(): Promise<void> {
    await this.completion.promise.then(() => {}, () => {});
    this.state = 'completed';
    this.cancel();
  }
}

async function isSettled(promise: PromiseLike<unknown>): Promise<boolean> {
  let sigil = Symbol();
  try {
    let result = await Promise.race([promise, new Promise(r => setTimeout(() => r(sigil), 25))]);
    return result !== sigil;
  } catch {
    return true;
  }
}
