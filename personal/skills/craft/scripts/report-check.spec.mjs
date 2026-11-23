import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { checkReport, checkReportFile } from './report-check.mjs';
import { packetProbes } from './report-skeleton.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, 'fixtures/root-tsconfig');
const packetFile = path.join(directory, 'fixtures/packet.md');
const probes = ['craft-1.1', 'craft-1.3'];

function report(rows, coverage = '2 of 2', metadata = '{"packet":"angular","section":"1"}') {
  return `<!-- craft-report: ${metadata} -->\n\n## Files reviewed\n\n- \`libs/widgets/example.ts\` — target\n\n## Findings\n\n| Probe | Finding (\`file:line\`) | Class | Action |\n| --- | --- | --- | --- |\n${rows.join('\n')}\n\n## Coverage: ${coverage} probes examined\n\n| Probe | Finding (\`file:line\`) | Class | Action |\n| --- | --- | --- | --- |\n\n## Debt\n`;
}

const completeRows = [
  '| `craft-1.1` | `example.ts:4` Missing label | mandated | Add label and test |',
  '| `craft-1.3` | no findings — 3 bindings inspected | | none |',
];

test('accepts complete coverage with an open finding', () => {
  assert.deepEqual(checkReport(report(completeRows), probes), []);
});

test('reads numbered section probes from the canonical packet file', () => {
  const folder = mkdtempSync(path.join(os.tmpdir(), 'craft-report-'));
  const file = path.join(folder, 'report.md');
  writeFileSync(file, report(completeRows));
  assert.deepEqual(checkReportFile(file, { root, packetFile }), []);
});

test('checks a completed architecture report against its packet probes', () => {
  const folder = mkdtempSync(path.join(os.tmpdir(), 'craft-report-'));
  const file = path.join(folder, 'report.md');
  const rows = [
    '| `architecture-7.1` | no findings — constructor inspected | | none |',
    '| `architecture-7.2` | not applicable — no shared dependencies | | none |',
  ];
  writeFileSync(file, report(rows, '2 of 2', '{"packet":"architecture"}'));
  assert.deepEqual(checkReportFile(file, { root, packetFile }), []);
});

test('reports a missing file and malformed metadata', () => {
  assert.deepEqual(checkReportFile('/no/such/report.md', { root, packetFile }), ['report is missing or unreadable']);
  const folder = mkdtempSync(path.join(os.tmpdir(), 'craft-report-'));
  const file = path.join(folder, 'report.md');
  writeFileSync(file, report(completeRows, '2 of 2', '{bad json}'));
  assert.deepEqual(checkReportFile(file, { root, packetFile }), ['malformed report metadata JSON']);
  writeFileSync(file, report(completeRows).replace(/^<!-- craft-report:.*\n/, ''));
  assert.deepEqual(checkReportFile(file, { root, packetFile }), ['missing or malformed report metadata header']);
});

test('counts identifiers only in Probe cells, including merged cells', () => {
  const merged = ['| `craft-1.1`, `craft-1.3` | `example.ts:4` Shared issue | fix | Check `craft-9.9` elsewhere |'];
  assert.deepEqual(checkReport(report(merged), probes), []);
  const misplaced = ['| `craft-1.1` | `example.ts:4` Issue | fix | Also check `craft-1.3` |'];
  assert.deepEqual(checkReport(report(misplaced, '1 of 2'), probes), ['missing probe craft-1.3']);
});

test('reports duplicate, missing and unknown probe identifiers', () => {
  const rows = [
    '| `craft-1.1` | no findings — 2 files read | | none |',
    '| `craft-1.1`, `craft-9.9` | no findings — 3 files read | | none |',
  ];
  const problems = checkReport(report(rows), probes);
  assert.ok(problems.some((problem) => problem.includes('duplicate probe craft-1.1')));
  assert.ok(problems.some((problem) => problem.includes('unknown probe craft-9.9')));
  assert.ok(problems.some((problem) => problem.includes('missing probe craft-1.3')));
});

test('reports placeholders and unresolved imports but ignores TODO in cited code', () => {
  const source = `${report(completeRows)}\nTODO\n| TODO | TODO | TODO | TODO |\n<!-- unresolved: example.ts -> ./missing -->\n`;
  assert.equal(checkReport(source, probes).filter((problem) => problem.includes('TODO placeholder or unresolved import')).length, 3);
  const cited = report([
    '| `craft-1.1` | `example.ts:4` contains `TODO` in cited code | fix | Resolve it |',
    completeRows[1],
  ]);
  assert.deepEqual(checkReport(cited, probes), []);
});

test('requires evidence or a reason in each empty form', () => {
  for (const form of ['no findings', 'not applicable', 'readiness pending', 'debt noted']) {
    const rows = [`| \`craft-1.1\` | ${form} — | | none |`, completeRows[1]];
    assert.ok(checkReport(report(rows), probes).some((problem) => problem.includes('empty form lacks evidence or reason')));
  }
});

test('rejects punctuation, capitalization and shorthand as evidence-less empty answers', () => {
  for (const finding of ['no findings.', 'No findings', 'no findings—', 'n/a']) {
    const rows = [`| \`craft-1.1\` | ${finding} | | none |`, completeRows[1]];
    assert.ok(checkReport(report(rows), probes).some((problem) => problem.includes('empty form lacks evidence or reason')));
  }
});

test('rejects an inaccurate Coverage claim', () => {
  assert.ok(checkReport(report(completeRows, '1 of 2'), probes).some((problem) => problem.includes('Coverage declares 1 of 2')));
});

test('CLI reports batch success in one line and failures per report', () => {
  const folder = mkdtempSync(path.join(os.tmpdir(), 'craft-report-'));
  const first = path.join(folder, 'first.md');
  const second = path.join(folder, 'second.md');
  const canonical = packetProbes('angular', '1', path.join(directory, '../references/packets/angular.md'));
  const rows = canonical.map((probe) => `| \`${probe}\` | no findings — 1 file inspected | | none |`);
  const source = report(rows, `${canonical.length} of ${canonical.length}`);
  writeFileSync(first, source);
  writeFileSync(second, source);
  const script = path.join(directory, 'report-check.mjs');
  const success = spawnSync(process.execPath, [script, first, second], { cwd: root, encoding: 'utf8' });
  assert.equal(success.status, 0);
  assert.equal(success.stdout, '2 reports checked\n');
  const failure = spawnSync(process.execPath, [script, first, '/no/such/report.md'], { cwd: root, encoding: 'utf8' });
  assert.notEqual(failure.status, 0);
  assert.match(failure.stderr, /\/no\/such\/report\.md: report is missing or unreadable/);
});
