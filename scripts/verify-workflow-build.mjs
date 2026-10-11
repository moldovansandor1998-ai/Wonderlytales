import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// A successful Next build alone does not guarantee that Workflow discovered
// the step directives. Validate the generated registrations before deployment.
const root = 'src/app/.well-known/workflow/v1';
const manifest = JSON.parse(readFileSync(`${root}/manifest.json`, 'utf8'));
const registrations = readFileSync(`${root}/flow/__step_registrations.js`, 'utf8');
for (const [file, workflow] of [['scene-batch', 'sceneBatch'], ['finished-video', 'finishedVideo']]) {
  const source = `src/workflows/${file}.ts`;
  assert(manifest.workflows[source]?.[workflow], `Missing workflow: ${workflow}`);
  for (const step of ['claim', 'advance', 'pause']) {
    assert.equal(manifest.steps[source]?.[step]?.stepId, `step//./src/workflows/${file}//${step}`, `Missing step: ${file}/${step}`);
  }
  assert(registrations.includes(`/workflows/${file}.ts`), `Missing registration import: ${file}`);
}
console.log('Verified 2 production workflows and all 6 processing steps.');
