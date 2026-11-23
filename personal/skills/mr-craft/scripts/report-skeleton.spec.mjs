import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { buildSkeleton, packetProbes, parseArguments, parseJsonc } from './report-skeleton.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, 'fixtures/root-tsconfig');
const fixtureRoot = path.join(directory, 'fixtures/root-tsconfig');
const packetFile = path.join(directory, 'fixtures/packet.md');
const target = 'libs/widgets/src/lib/hint';
const hint = `${target}/hint.ts`;

function skeleton(packet = 'correctness', section) {
  return buildSkeleton({ '--target': target, '--packet': packet, '--section': section }, { root: fixtureRoot, packetFile }).output;
}

test('follows relative imports, barrels, aliases and dynamic imports', () => {
  const report = skeleton();
  assert.match(report, /`libs\/helpers\/src\/lib\/barrel\/index\.ts` — consumed via .*hint\.ts/);
  assert.match(report, /`libs\/helpers\/src\/lib\/value\.ts` — consumed via .*barrel\/index\.ts/);
  assert.match(report, /`libs\/helpers\/src\/index\.ts` — consumed via .*hint\.ts \(@sample\/helpers\)/);
  assert.match(report, /`libs\/helpers\/src\/lib\/shared\.ts` — consumed via .*helpers\/src\/index\.ts/);
  assert.match(report, /`libs\/helpers\/src\/lib\/lazy\.ts` — consumed via .*hint\.ts/);
});

test('resolves workspace package roots and subpath exports without expanding components', () => {
  const report = skeleton();
  assert.match(report, /`libs\/widgets\/src\/public_api\.ts` — contract only \(@sample\/widgets\)/);
  assert.match(report, /`libs\/widgets\/testing\/src\/public-api\.ts` — contract only \(@sample\/widgets\/testing\)/);
  assert.match(report, /`libs\/tools\/src\/index\.ts` — consumed via .*hint\.ts \(@sample\/tools\)/);
  assert.match(report, /`libs\/tools\/src\/utility\.ts` — consumed via .*tools\/src\/index\.ts/);
  assert.doesNotMatch(report, /unrelated\.ts/);
  assert.doesNotMatch(report, /hint\.ts -> @sample\/widgets/);
});

test('app imports stop at published component entries and expand utility entries', () => {
  const output = buildSkeleton({ '--root': fixtureRoot, '--target': 'apps/dashboard/src/lib/panel', '--packet': 'angular', '--section': '1' }, { packetFile }).output;
  assert.match(output, /`libs\/widgets\/src\/public_api\.ts` — contract only \(@sample\/widgets\)/);
  assert.doesNotMatch(output, /`libs\/widgets\/src\/lib\/other\/other\.ts`/);
  assert.match(output, /`libs\/tools\/src\/index\.ts` — consumed via .*panel\.ts \(@sample\/tools\)/);
  assert.match(output, /`libs\/tools\/src\/utility\.ts` — consumed via .*index\.ts/);
});

test('workspace package scan skips nested worktrees and malformed manifests and keeps the first duplicate', () => {
  const report = skeleton();
  assert.match(report, /`libs\/tools\/src\/index\.ts`/);
  assert.doesNotMatch(report, /zz-tools|foreign\/libs\/tools|libs\/broken/);
});

test('git-backed package scan ignores nested worktree entries', () => {
  const bin = mkdtempSync(path.join(os.tmpdir(), 'fake-git-'));
  writeFileSync(path.join(bin, 'git'), `#!/usr/bin/env node
process.stdout.write('.claude/worktrees/foreign/libs/tools/package.json\\0libs/tools/package.json\\0');
`, { mode: 0o755 });
  const source = `import { buildSkeleton } from ${JSON.stringify(path.join(directory, 'report-skeleton.mjs'))};
process.stdout.write(buildSkeleton({ '--root': ${JSON.stringify(fixtureRoot)}, '--target': 'apps/dashboard/src/lib/panel', '--packet': 'angular', '--section': '1' }, { packetFile: ${JSON.stringify(packetFile)} }).output);
`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', source], {
    cwd: fixtureRoot,
    encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /`libs\/tools\/src\/index\.ts` — consumed via .*panel\.ts/);
  assert.doesNotMatch(result.stdout, /foreign\/libs\/tools|zz-tools/);
  assert.doesNotMatch(result.stdout, /`libs\/widgets\/src\/public_api\.ts`/);
});

test('maps a .js import to its TypeScript source', () => {
  const report = skeleton();
  assert.match(report, /`.*helpers\/src\/lib\/js-helper\.ts` — consumed via .*hint\.ts/);
  assert.doesNotMatch(report, /hint\.ts -> .*js-helper\.js/);
});

test('follows template, style and transitive Sass references', () => {
  const report = skeleton();
  assert.match(report, /`.*hint\/hint\.html` — target/);
  assert.match(report, /`.*hint\/hint\.scss` — target/);
  assert.match(report, /`.*helpers\/src\/lib\/_colors\.scss` — consumed via .*hint\.scss/);
  assert.match(report, /`.*helpers\/src\/lib\/_palette\.scss` — consumed via .*_colors\.scss/);
  assert.match(report, /`.*helpers\/src\/lib\/_theme\.scss` — consumed via .*hint\.scss/);
  assert.match(report, /`.*helpers\/src\/lib\/base\.css` — consumed via .*extra\.css/);
});

test('stops at other catalogued components but follows _internal', () => {
  const report = skeleton();
  assert.match(report, /`.*\/other\/other\.ts` — contract only/);
  assert.doesNotMatch(report, /should-not-follow\.ts/);
  assert.match(report, /`.*\/_internal\/internal\.ts` — consumed via .*hint\.ts/);
  assert.match(report, /`.*helpers\/src\/lib\/internal-helper\.ts` — consumed via .*_internal\/internal\.ts/);
});

test('excludes specs except angular tests section', () => {
  assert.doesNotMatch(skeleton(), /hint\.spec\.ts/);
  const testsReport = skeleton('angular', '6');
  assert.match(testsReport, /`.*hint\/hint\.spec\.ts` — target/);
  assert.match(testsReport, /`.*hint\/spec-helper\.ts` — target/);
});

test('includes specs for an unsplit angular packet', () => {
  const report = skeleton('angular');
  assert.match(report, /`.*hint\/hint\.spec\.ts` — target/);
  assert.match(report, /\| `craft-6\.1` \| TODO \| TODO \| TODO \|/);
  assert.doesNotMatch(skeleton('angular', '1'), /hint\.spec\.ts/);
});

test('lists unresolved first-party references and excludes npm packages', () => {
  const report = skeleton();
  assert.match(report, /<!-- unresolved: .*hint\.ts -> \.\/missing -->/);
  assert.doesNotMatch(report, /external-package/);
});

test('extracts exact top-level probe ids with and without a section', () => {
  assert.deepEqual(packetProbes('angular', '1', packetFile), ['craft-1.1', 'craft-1.3']);
  assert.deepEqual(packetProbes('angular', undefined, packetFile), ['craft-1.1', 'craft-1.3', 'craft-2.1', 'craft-6.1', 'craft-9.9']);
  const report = skeleton('angular', '1');
  assert.match(report, /\| `craft-1\.1` \| TODO \| TODO \| TODO \|/);
  assert.match(report, /## Coverage: 0 of 2 probes examined/);
  assert.doesNotMatch(report, /\| `craft-2\.1` \|/);
});

test('architecture skeleton includes both review sections and one row per architecture probe', () => {
  const options = parseArguments(['--target', target, '--packet', 'architecture']);
  const { output, probeCount } = buildSkeleton(options, { root: fixtureRoot, packetFile });
  assert.match(output, /^<!-- mr-craft-report: {"packet":"architecture"} -->/);
  assert.match(output, /## Architecture as found\n\nTODO\n\n## Abstractions reviewed\n\nTODO\n\n## Findings/);
  assert.deepEqual(output.match(/^\| `architecture-.*$/gm), [
    '| `architecture-7.1` | TODO | TODO | TODO |',
    '| `architecture-7.2` | TODO | TODO | TODO |',
  ]);
  assert.equal(probeCount, 2);
  assert.match(output, /## Coverage: 0 of 2 probes examined/);
});

test('skeleton includes concise report identity for a numbered section', () => {
  const report = skeleton('angular', '1');
  assert.match(report, /^<!-- mr-craft-report: {"packet":"angular","section":"1"} -->\n/);
  assert.doesNotMatch(report, /"(?:coverage|status|timestamp)"/);
});

test('real angular section 1 count matches its top-level check bullets', () => {
  const file = path.join(directory, '../references/packets/angular.md');
  const section = readFileSync(file, 'utf8').split(/^## 2\./m)[0].split(/^## 1\./m)[1];
  const grepCount = [...section.matchAll(/^- `craft-1\.[0-9]+`/gm)].length;
  assert.ok(grepCount > 0);
  assert.equal(packetProbes('angular', '1', file).length, grepCount);
});

test('JSONC comments and trailing commas do not alter alias paths', () => {
  assert.deepEqual(parseJsonc('{ "paths": { "examples/*": ["./examples/*",], }, // note\n }').paths['examples/*'], ['./examples/*']);
});

test('CLI gives usage on help and invalid arguments', () => {
  const script = path.join(directory, 'report-skeleton.mjs');
  const help = spawnSync(process.execPath, [script, '--help'], { cwd: root, encoding: 'utf8' });
  const bad = spawnSync(process.execPath, [script, '--root', fixtureRoot, '--packet', 'unknown'], { cwd: root, encoding: 'utf8' });
  const outside = spawnSync(process.execPath, [script, '--root', fixtureRoot, '--target', '..', '--packet', 'correctness'], { cwd: directory, encoding: 'utf8' });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /^Usage:/);
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /Usage:/);
  assert.notEqual(outside.status, 0);
  assert.match(outside.stderr, /inside --root/);
});

test('CLI accepts --root and resolves packet names from the skill', () => {
  const script = path.join(directory, 'report-skeleton.mjs');
  const result = spawnSync(process.execPath, [script, '--root', fixtureRoot, '--target', target, '--packet', 'angular', '--section', '1'], { cwd: directory, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^<!-- mr-craft-report: {"packet":"angular","section":"1"} -->/);
  assert.match(result.stdout, /## Coverage: 0 of \d+ probes examined/);
});

test('explicit --tsconfig overrides nearest config', () => {
  const nestedRoot = path.join(directory, 'fixtures/nested-workspace');
  const nestedTarget = 'apps/web/libs/widgets/src/lib/hint';
  const options = parseArguments(['--root', nestedRoot, '--target', nestedTarget, '--packet', 'angular', '--section', '1', '--tsconfig', 'apps/web/tsconfig.base.json']);
  const report = buildSkeleton(options, { packetFile }).output;
  assert.match(report, /`apps\/web\/libs\/helpers\/src\/index\.ts` — consumed via .*hint\.ts/);
});

test('nested workspace finds its own tsconfig and custom export condition', () => {
  const root = path.join(directory, 'fixtures/nested-workspace');
  const target = 'apps/web/libs/widgets/src/lib/hint';
  const report = buildSkeleton({ '--root': root, '--target': target, '--packet': 'angular', '--section': '1' }, { packetFile }).output;
  assert.match(report, /`apps\/web\/libs\/helpers\/src\/index\.ts`/);
  assert.match(report, /`apps\/web\/libs\/widgets\/src\/public-api\.ts` — contract only \(@sample\/widgets\)/);
  assert.doesNotMatch(report, /hint\.ts -> @sample\/widgets/);
});

test('accepts an explicit packet path', () => {
  const report = buildSkeleton({ '--root': fixtureRoot, '--target': target, '--packet': packetFile, '--section': '1' }).output;
  assert.match(report, /^<!-- mr-craft-report: {"packet":"angular","section":"1"} -->/);
});

test('relative tsconfig extends arrays merge aliases and preserve each baseUrl', () => {
  const project = mkdtempSync(path.join(os.tmpdir(), 'tsconfig-'));
  for (const folder of ['src/feature', 'other-src']) mkdirSync(path.join(project, folder), { recursive: true });
  writeFileSync(path.join(project, 'src/feature/entry.ts'), "import '@base'; import '@mid'; import '@other'; import '@shared'; import '@leaf';\n");
  for (const name of ['base', 'mid', 'other', 'overridden']) writeFileSync(path.join(project, `src/${name}.ts`), `export const ${name} = true;\n`);
  writeFileSync(path.join(project, 'other-src/leaf.ts'), 'export const leaf = true;\n');
  writeFileSync(path.join(project, 'base.json'), JSON.stringify({ compilerOptions: { baseUrl: './src', paths: { '@base': ['base.ts'], '@shared': ['base.ts'] } } }));
  writeFileSync(path.join(project, 'middle.json'), JSON.stringify({ extends: './base.json', compilerOptions: { paths: { '@mid': ['mid.ts'] } } }));
  writeFileSync(path.join(project, 'other.json'), JSON.stringify({ extends: './base.json', compilerOptions: { paths: { '@other': ['other.ts'], '@shared': ['overridden.ts'] } } }));
  writeFileSync(path.join(project, 'leaf.json'), JSON.stringify({ extends: ['./middle.json', './other.json'], compilerOptions: { baseUrl: './other-src', paths: { '@leaf': ['leaf.ts'] } } }));
  const report = buildSkeleton({ '--root': project, '--target': 'src/feature', '--packet': 'angular', '--section': '1', '--tsconfig': 'leaf.json' }, { packetFile }).output;
  for (const name of ['base', 'mid', 'other', 'overridden']) assert.match(report, new RegExp(`src/${name}\\.ts`));
  assert.match(report, /other-src\/leaf\.ts/);
  assert.doesNotMatch(report, /<!-- unresolved:/);
});

test('tsconfig extends cycle fails with a useful error', () => {
  const project = mkdtempSync(path.join(os.tmpdir(), 'tsconfig-cycle-'));
  mkdirSync(path.join(project, 'src'), { recursive: true });
  writeFileSync(path.join(project, 'src/entry.ts'), 'export const entry = true;\n');
  writeFileSync(path.join(project, 'one.json'), JSON.stringify({ extends: './two.json' }));
  writeFileSync(path.join(project, 'two.json'), JSON.stringify({ extends: './one.json' }));
  assert.throws(() => buildSkeleton({ '--root': project, '--target': 'src', '--packet': 'angular', '--tsconfig': 'one.json' }, { packetFile }), /tsconfig extends cycle/);
});
