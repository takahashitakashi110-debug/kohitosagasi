import { appendFileSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

function filesAt(path) {
  if (!existsSync(path)) return [];
  return readdirSync(path, { withFileTypes: true }).flatMap(entry => {
    const file = join(path, entry.name);
    return entry.isDirectory() ? filesAt(file) : [file];
  });
}
const files = filesAt('test-results');
const images = files.filter(p => p.endsWith('.png'));
const traces = files.filter(p => p.endsWith('trace.zip'));
const report = existsSync('test-results/results.json') ? JSON.parse(readFileSync('test-results/results.json', 'utf8')) : null;
const stats = report?.stats;
const artifactName = process.env.ARTIFACT_NAME || 'local-e2e';
const artifactUrl = process.env.ARTIFACT_URL || (process.env.GITHUB_RUN_ID
  ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : null);
const summary = [
  '## Mobile button tests',
  `Result: **${process.env.TEST_OUTCOME || 'not run'}**`,
  stats ? `Passed: ${stats.expected}; failed: ${stats.unexpected}; skipped: ${stats.skipped}; flaky: ${stats.flaky}` : 'No Playwright report (see preceding setup/build steps).',
  'Projects: 390×844 and 360×640, touch/mobile, DPR 2, Chromium against the production build.',
  artifactUrl ? `Evidence: [${artifactName}](${artifactUrl}) (14 days)` : `Evidence: ${artifactName} in test-results/`,
  `Screenshots: ${images.length}; failure traces: ${traces.length}`,
  '',
  ...images.concat(traces).map(p => `- \`${p}\``),
  '',
].join('\n');
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);

// アップロードが成功しただけでなく、必要な証跡が実際に生成されたことも検査する。
if (process.env.TEST_OUTCOME === 'success' && (images.length < 4 || traces.length !== 0)) {
  throw new Error('Expected success screenshots and no retained success traces.');
}
if (process.env.TEST_OUTCOME === 'failure' && report && (images.length === 0 || traces.length === 0)) {
  throw new Error('Expected failure screenshots and trace.zip.');
}
