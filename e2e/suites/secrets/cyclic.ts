// Fixture: cyclic dependency — should fail with a clear error
import { script } from 'dotts';

export default () => {
  const a = script('echo a', { unless: 'false' });
  const b = script('echo b', { unless: 'false', dependsOn: [a] });
  // Manually inject cyclic dep (a depends on b which depends on a)
  a.addDependency(b);
};
