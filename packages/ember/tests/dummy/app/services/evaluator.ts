import Service from '@ember/service';
import { Evaluation } from '../utils/evaluation';
import { deactivateAllMilestones } from '@milestones/core';

export default class EvaluatorService extends Service {
  private currentEvaluation?: Evaluation;

  public evaluate(preamble: string, blocks: Record<string, string>, importFn: (path: string) => unknown): Evaluation {
    if (this.currentEvaluation) {
      this.currentEvaluation.cancel();
    }

    deactivateAllMilestones();

    return (this.currentEvaluation = new Evaluation(preamble, blocks, importFn));
  }
}
