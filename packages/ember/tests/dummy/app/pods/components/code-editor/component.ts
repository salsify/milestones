import Component from '@ember/component';
import { stripIndent } from 'common-tags';
import styles from './styles';
import { Range } from 'ember-ace';

/**
 * Provides a code editor whose value can be initially set based
 * on a passed in block, e.g.
 *
 * ```hbs
 * <CodeEditor @title='My Code'>
 *   import foo from 'bar';
 *   console.log(foo);
 * </CodeEditor>
 * ```
 *
 *  Any received code will automatically be dedented.
 */
export default class CodeEditorComponent extends Component {
  public title = '';
  public code = '';
  public markers: Marker[] = [];
  public isError = false;

  public onChange: (key: string) => void = () => {};
  public onReady: (key: string, api: CodeEditorAPI) => void = () => {};

  private editor?: AceAjax.Editor;
  private previousLines = new Set<number>();

  protected readCode(element: HTMLDivElement): void {
    this.set('code', stripIndent`${element.textContent}` + '\n');
  }

  protected setCode(code: string): void {
    this.set('code', code);
    this.onChange(this.title);
  }

  protected editorReady(editor: AceAjax.Editor): void {
    this.editor = editor;
    this.editor.session.setUseWorker(false);
    this.editor.renderer.setShowGutter(false);
    this.editor.renderer.setPadding(10);
    this.editor.renderer.setScrollMargin(10, 10, 0, 0);

    this.onReady(this.title, {
      getCode: () => this.code,
      setError: error => this.set('isError', error),
      setActiveLines: lines => this.setActiveLines(lines),
    });
  }

  private setActiveLines(lines: ({ type: string; line: number })[]): void {
    this.set(
      'markers',
      lines.map(({ type, line }) => ({
        class: styles[`active-line-${type}`],
        range: new Range(line - 1, 0, line, 0),
        inFront: false,
        type: 'full-row',
      })),
    );

    let { previousLines } = this;
    let currentLines = lines.map(({ line }) => line);
    let differentLine = currentLines.find(line => !previousLines.has(line));
    this.previousLines = new Set(currentLines);
    if (this.editor && typeof differentLine === 'number') {
      this.editor.scrollToLine(differentLine, true, false, () => {});
    }
  }
}

interface Marker {
  class: string;
  range: Range;
  inFront: boolean;
  type: string;
}

/**
 * An imperative API used by MilestonesPlayground to read and set
 * state for a particular editor based on an ongoing evaluation.
 */
export interface CodeEditorAPI {
  getCode(): string;
  setError(error: boolean): void;
  setActiveLines(lines: ({ type: string; line: number })[]): void;
}
