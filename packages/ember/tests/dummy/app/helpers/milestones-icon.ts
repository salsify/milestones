import { helper } from '@ember/component/helper';
import { htmlSafe } from '@ember/string';
import styles from './styles';

// @ts-ignore
import milestonesSVG from 'ember-svg-jar/inlined/milestones-icon';

export default helper((_params: unknown[], hash: Record<string, unknown>) => {
  return htmlSafe(`
    <div class="${hash.class || ''}">
      <svg viewBox="0 25 256 240" class="${styles.svg}">
        ${milestonesSVG.content}
      </svg>
      Milestones
    </div>
  `);
});
