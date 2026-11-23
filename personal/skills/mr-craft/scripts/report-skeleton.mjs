#!/usr/bin/env node
import fs, { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const prefixes = {
  angular: 'craft', performance: 'perf', correctness: 'correct', architecture: 'architecture',
};
const usage = 'Usage: node <skill-dir>/scripts/report-skeleton.mjs [--root <dir>] [--tsconfig <file>] --target <folder> --packet <name|path> [--section <n>] [--changed <file>] [--out <file>]';

function defaultRoot() {
  try { return execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return process.cwd(); }
}

function packetFile(value) {
  if (Object.hasOwn(prefixes, value)) return path.join(scriptDirectory, '../references/packets', `${value}.md`);
  return path.resolve(value);
}

function packetName(value) {
  if (Object.hasOwn(prefixes, value)) return value;
  const basename = path.basename(value, '.md');
  if (Object.hasOwn(prefixes, basename)) return basename;
  const content = readFileSync(packetFile(value), 'utf8');
  const first = /^- `([a-z][a-z-]*)-\d+\.\d+`/m.exec(content)?.[1];
  return Object.keys(prefixes).find((name) => prefixes[name] === first);
}

function fail(message) {
  throw new Error(`${message}\n${usage}`);
}

function parseArguments(argumentsList) {
  if (argumentsList.length === 1 && argumentsList[0] === '--help') return { help: true };
  const options = {};
  for (let index = 0; index < argumentsList.length; index += 2) {
    const key = argumentsList[index];
    const value = argumentsList[index + 1];
    if (!['--root', '--tsconfig', '--target', '--packet', '--section', '--changed', '--out'].includes(key) || !value || value.startsWith('--')) fail(`Invalid argument: ${key ?? '(missing)'}`);
    if (options[key]) fail(`Repeated argument: ${key}`);
    options[key] = value;
  }
  if (!options['--target'] || !options['--packet']) fail('--target and --packet are required.');
  if (options['--section'] && !/^[1-9]\d*$/.test(options['--section'])) fail('--section requires a positive integer.');
  return options;
}

function isInside(parent, file) {
  const relative = path.relative(parent, file);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function relativePath(root, file) {
  return path.relative(root, file).split(path.sep).join('/');
}

function parseJsonc(source) {
  let output = '';
  let state = 'code';
  for (let index = 0; index < source.length; index++) {
    const current = source[index];
    const next = source[index + 1];
    if (state === 'string') {
      output += current;
      if (current === '\\') output += source[++index] ?? '';
      else if (current === '"') state = 'code';
    } else if (state === 'line') {
      if (current === '\n') { output += '\n'; state = 'code'; }
    } else if (state === 'block') {
      if (current === '*' && next === '/') { state = 'code'; index++; }
      else if (current === '\n') output += '\n';
    } else if (current === '"') { output += current; state = 'string'; }
    else if (current === '/' && next === '/') { state = 'line'; index++; }
    else if (current === '/' && next === '*') { state = 'block'; index++; }
    else output += current;
  }
  return JSON.parse(output.replace(/,\s*([}\]])/g, '$1'));
}

function listFiles(folder) {
  return readdirSync(folder, { withFileTypes: true })
    .sort((first, second) => first.name.localeCompare(second.name))
    .flatMap((entry) => {
      const file = path.join(folder, entry.name);
      return entry.isDirectory() ? listFiles(file) : entry.isFile() ? [file] : [];
    });
}

function references(file) {
  const source = readFileSync(file, 'utf8');
  const found = [];
  const collect = (expression) => {
    for (const match of source.matchAll(expression)) found.push({ specifier: match[1], offset: match.index });
  };
  if (/\.(?:[cm]?js|tsx?|jsx?)$/.test(file)) {
    collect(/\b(?:import|export)\s+[^;]*?\s+from\s*['"]([^'"]+)['"]/g);
    collect(/\bimport\s*['"]([^'"]+)['"]/g);
    collect(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g);
    collect(/\btemplateUrl\s*:\s*['"]([^'"]+)['"]/g);
    collect(/\bstyleUrl\s*:\s*['"]([^'"]+)['"]/g);
    for (const match of source.matchAll(/\bstyleUrls\s*:\s*\[([^\]]*)\]/g)) {
      for (const item of match[1].matchAll(/['"]([^'"]+)['"]/g)) found.push({ specifier: item[1], offset: match.index + item.index });
    }
  }
  if (/\.(?:s[ac]ss|css)$/.test(file)) {
    collect(/@(?:use|forward|import)\s+['"]([^'"]+)['"]/g);
    collect(/@import\s+url\(\s*['"]?([^'"\s)]+)['"]?\s*\)/g);
  }
  return found.sort((first, second) => first.offset - second.offset).map(({ specifier }) => specifier);
}

function resolveFile(base, stylesheet) {
  const endings = ['', '.ts', '.tsx', '.js', '.mjs', '.html', '.scss', '.sass', '.css', '.json', '/index.ts', '/index.js'];
  const candidates = endings.map((ending) => `${base}${ending}`);
  if (/\.(?:[cm]?js|jsx)$/.test(base)) {
    const sourceBase = base.replace(/\.(?:[cm]?js|jsx)$/, '');
    candidates.push(...['.ts', '.tsx', '.mts', '.cts'].map((ending) => `${sourceBase}${ending}`));
  }
  if (stylesheet) {
    const directory = path.dirname(base);
    const name = path.basename(base);
    candidates.push(...['.scss', '.sass', '.css'].map((ending) => path.join(directory, `_${name}${ending}`)));
    candidates.push(...['.scss', '.sass'].map((ending) => path.join(base, `_index${ending}`)));
  }
  return candidates.find((file) => existsSync(file) && statSync(file).isFile());
}

function workspacePackages(root) {
  const packages = new Map();
  function addManifest(file) {
    try {
      const manifest = JSON.parse(readFileSync(file, 'utf8'));
      if (typeof manifest.name === 'string' && !packages.has(manifest.name)) {
        packages.set(manifest.name, { folder: path.dirname(file), exports: manifest.exports });
      }
    } catch { /* A malformed manifest cannot identify a workspace package. */ }
  }
  try {
    const output = execFileSync('git', ['-C', root, 'ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', '*package.json', '**/package.json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    for (const relative of output.split('\0').filter(Boolean)) {
      const segments = relative.split('/');
      if (segments.some((part, index) => ['node_modules', 'dist', 'coverage'].includes(part) || (part === 'worktrees' && segments[index - 1] === '.claude'))) continue;
      const file = path.resolve(root, relative);
      if (isInside(root, file) && path.basename(file) === 'package.json' && existsSync(file)) addManifest(file);
    }
    return packages;
  } catch { /* A folder outside git has no index to query. */ }
  function visit(folder) {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || ['node_modules', 'dist', 'coverage'].includes(entry.name)) continue;
      const file = path.join(folder, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile() && entry.name === 'package.json') addManifest(file);
    }
  }
  visit(root);
  return packages;
}

function readTsconfig(file, active = new Set()) {
  const absolute = path.resolve(file);
  if (active.has(absolute)) throw new Error(`tsconfig extends cycle at ${absolute}`);
  active.add(absolute);
  try {
    const config = parseJsonc(readFileSync(absolute, 'utf8'));
    let result = { baseUrl: undefined, paths: {} };
    const extensions = config.extends === undefined ? [] : Array.isArray(config.extends) ? config.extends : [config.extends];
    for (const extension of extensions) {
      if (typeof extension !== 'string' || !extension.startsWith('.')) continue;
      const base = path.resolve(path.dirname(absolute), extension);
      const parent = readTsconfig(path.extname(base) ? base : `${base}.json`, active);
      result = { baseUrl: parent.baseUrl ?? result.baseUrl, paths: { ...result.paths, ...parent.paths } };
    }
    const options = config.compilerOptions ?? {};
    const baseUrl = typeof options.baseUrl === 'string' ? path.resolve(path.dirname(absolute), options.baseUrl) : result.baseUrl;
    const pathBase = baseUrl ?? path.dirname(absolute);
    for (const [alias, targets] of Object.entries(options.paths ?? {})) {
      result.paths[alias] = (Array.isArray(targets) ? targets : [targets]).filter((item) => typeof item === 'string').map((item) => path.resolve(pathBase, item));
    }
    return { baseUrl, paths: result.paths };
  } finally { active.delete(absolute); }
}

function exportSource(entry, folder) {
  if (typeof entry === 'string') return resolveFile(path.resolve(folder, entry)) ? entry : undefined;
  if (!entry || typeof entry !== 'object') return undefined;
  for (const key of ['source', ...Object.keys(entry).filter((key) => !['source', 'types', 'default', 'import', 'require'].includes(key)), 'import', 'default', 'require']) {
    const result = exportSource(entry[key], folder);
    if (result) return result;
  }
  return undefined;
}

function resolveReference(root, importer, specifier, paths, packages) {
  const stylesheet = /\.(?:s[ac]ss|css)$/.test(importer);
  if (specifier.startsWith('.')) return { file: resolveFile(path.resolve(path.dirname(importer), specifier), stylesheet) };
  for (const [alias, targets] of Object.entries(paths)) {
    const wildcard = alias.indexOf('*');
    const prefix = wildcard < 0 ? alias : alias.slice(0, wildcard);
    const suffix = wildcard < 0 ? '' : alias.slice(wildcard + 1);
    if (wildcard < 0 ? specifier !== alias : !specifier.startsWith(prefix) || !specifier.endsWith(suffix)) continue;
    const value = wildcard < 0 ? '' : specifier.slice(prefix.length, specifier.length - suffix.length);
    for (const target of targets) {
      const file = resolveFile(target.replace('*', value), stylesheet);
      if (file) return { file, alias: specifier };
    }
    // Library aliases point at dist/, so an unbuilt or compiled target falls through to the
    // workspace package's own source entry.
    break;
  }
  const packageName = [...packages.keys()].sort((a, b) => b.length - a.length).find((name) => specifier === name || specifier.startsWith(`${name}/`));
  if (packageName) {
    const workspacePackage = packages.get(packageName);
    const subpath = specifier === packageName ? '.' : `.${specifier.slice(packageName.length)}`;
    const exported = typeof workspacePackage.exports === 'object'
      ? workspacePackage.exports[subpath]
      : subpath === '.' ? workspacePackage.exports : undefined;
    const source = exportSource(exported, workspacePackage.folder) ?? (subpath === '.' ? ['./src/public-api.ts', './src/public_api.ts', './src/index.ts'].find((candidate) => existsSync(path.resolve(workspacePackage.folder, candidate))) : undefined);
    return { file: source ? resolveFile(path.resolve(workspacePackage.folder, source)) : undefined,
      alias: specifier, contractOnly: source ? /(?:^|\/)public[-_]api\.ts$/.test(source) : false };
  }
  const aliased = Object.keys(paths).some((alias) => alias.includes('*') ? specifier.startsWith(alias.slice(0, alias.indexOf('*'))) : specifier === alias);
  return aliased ? { alias: specifier } : { external: true };
}

function nearestTsconfig(root, target) {
  for (let folder = target; isInside(root, folder); folder = path.dirname(folder)) {
    for (const name of ['tsconfig.base.json', 'tsconfig.json']) {
      const file = path.join(folder, name);
      if (existsSync(file)) return file;
    }
    if (folder === root) break;
  }
  return undefined;
}

function packetProbes(packet, section, packetFile) {
  const source = readFileSync(packetFile, 'utf8');
  let selected = source;
  if (section) {
    const lines = source.split('\n');
    const start = lines.findIndex((line) => line.startsWith(`## ${section}.`));
    if (start < 0) fail(`Section ${section} is absent from ${packetFile}.`);
    const next = lines.findIndex((line, index) => index > start && /^## [0-9]/.test(line));
    selected = lines.slice(start, next < 0 ? undefined : next + 1).join('\n');
  }
  const name = packetName(packet);
  const prefix = prefixes[name];
  const expression = new RegExp(`^- \\x60(${prefix}-[0-9]+\\.[0-9]+)\\x60`, 'gm');
  return [...new Set([...selected.matchAll(expression)].map((match) => match[1]))];
}

function buildSkeleton(options, context = {}) {
  const root = path.resolve(context.root ?? options['--root'] ?? defaultRoot());
  const targetArgument = options['--target'];
  const target = path.resolve(root, targetArgument);
  if (!isInside(root, target) || !existsSync(target) || !statSync(target).isDirectory()) fail('--target must be an existing folder inside --root.');
  const packet = options['--packet'];
  const section = options['--section'];
  const name = packetName(packet);
  if (!name) fail(`Unknown packet: ${packet}`);
  if (section && name !== 'angular') fail('--section requires angular.');
  const includeSpecs = name === 'angular' && (!section || section === '6');
  const changed = options['--changed']
    ? new Set(readFileSync(options['--changed'], 'utf8').split(/\r?\n/)
      .map((file) => path.posix.normalize(file.trim().replaceAll('\\', '/').replace(/^(?:\.\/)+/, '')))
      .filter((file) => file !== '.'))
    : null;
  const tsconfig = context.tsconfig ?? (options['--tsconfig'] ? path.resolve(root, options['--tsconfig']) : nearestTsconfig(root, target));
  const paths = tsconfig ? readTsconfig(tsconfig).paths : {};
  const packages = workspacePackages(root);
  const probes = packetProbes(packet, section, context.packetFile ?? packetFile(packet));
  const reviewed = new Map();
  const unresolved = new Set();
  const queue = [];
  const components = target.includes(`${path.sep}src${path.sep}lib${path.sep}`)
    ? path.dirname(target) : path.join(root, '__no_component_siblings__');
  const targetComponent = isInside(components, target) ? path.relative(components, target).split(path.sep)[0] : null;

  function enqueue(file, reason, packageContractOnly = false) {
    if (!isInside(root, file) || (!includeSpecs && file.endsWith('.spec.ts'))) return;
    if (reviewed.has(file)) {
      if (changed?.has(relativePath(root, file)) && !reviewed.get(file).startsWith('contract only')) reviewed.set(file, 'changed');
      return;
    }
    const relativeComponent = path.relative(components, file);
    const component = isInside(components, file) ? relativeComponent.split(path.sep)[0] : null;
    const contractOnly = packageContractOnly || (!isInside(target, file) && component && component !== '_internal' && component !== targetComponent);
    reviewed.set(file, contractOnly ? `contract only${packageContractOnly ? reason : ''}` : changed?.has(relativePath(root, file)) ? 'changed' : reason);
    if (!contractOnly) queue.push(file);
  }

  const targetFiles = listFiles(target);
  for (const file of targetFiles) {
    if (!changed || changed.has(relativePath(root, file))) enqueue(file, changed ? 'changed' : 'target');
  }
  if (changed && queue.length === 0) throw new Error(`No changed files this packet reviews in ${relativePath(root, target)}.`);
  if (changed) {
    for (const file of targetFiles.filter((candidate) => /\.(?:[cm]?ts|tsx)$/.test(candidate) && !candidate.endsWith('.spec.ts'))) {
      for (const specifier of references(file)) {
        const ownerOf = resolveReference(root, file, specifier, paths, packages).file;
        if (ownerOf && /\.(?:html|css|scss|sass)$/.test(ownerOf) && changed.has(relativePath(root, ownerOf))) {
          enqueue(file, `owner of ${relativePath(root, ownerOf)}`);
          break;
        }
      }
    }
  }
  const directImporters = queue.length;
  for (let index = 0; index < (changed ? directImporters : queue.length); index++) {
    const importer = queue[index];
    if (!/\.(?:[cm]?js|tsx?|jsx?|s[ac]ss|css)$/.test(importer)) continue;
    for (const specifier of references(importer)) {
      const resolved = resolveReference(root, importer, specifier, paths, packages);
      if (resolved.external) continue;
      if (!resolved.file || !isInside(root, resolved.file)) {
        unresolved.add(`${relativePath(root, importer)} -> ${specifier}`);
        continue;
      }
      const alias = resolved.alias ? ` (${resolved.alias})` : '';
      enqueue(resolved.file, resolved.contractOnly ? alias : `consumed via ${relativePath(root, importer)}${alias}`, resolved.contractOnly);
    }
  }

  const metadata = { packet: name, ...(section ? { section } : {}) };
  const lines = [`<!-- mr-craft-report: ${JSON.stringify(metadata)} -->`, '', '## Files reviewed', ''];
  for (const [file, reason] of [...reviewed].sort(([first], [second]) => relativePath(root, first).localeCompare(relativePath(root, second)))) {
    lines.push(`- \`${relativePath(root, file)}\` — ${reason}`);
  }
  if (name === 'architecture') {
    lines.push('', '## Architecture as found', '', 'TODO', '', '## Abstractions reviewed', '', 'TODO');
  }
  lines.push('', '## Findings', '', '| Probe | Finding (`file:line`) | Class | Action |', '| --- | --- | --- | --- |');
  for (const probe of probes) lines.push(`| \`${probe}\` | TODO | TODO | TODO |`);
  lines.push('', `## Coverage: 0 of ${probes.length} probes examined`, '', '| Probe | Finding (`file:line`) | Class | Action |', '| --- | --- | --- | --- |', '| TODO | TODO | TODO | TODO |', '', '## Debt', '', 'TODO', '', '## Readiness', '', 'TODO', '', "## Outside this review's scope", '', 'TODO');
  if (unresolved.size) lines.push('', `<!-- unresolved: ${[...unresolved].sort().join('; ')} -->`);
  return { output: `${lines.join('\n')}\n`, fileCount: reviewed.size, probeCount: probes.length };
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) { process.stdout.write(`${usage}\n`); return; }
  const { output } = buildSkeleton(options);
  if (options['--out']) writeFileSync(options['--out'], output);
  else process.stdout.write(output);
}

function isMainModule() {
  if (!process.argv[1]) return false;
  try {
    return fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isMainModule()) {
  try { main(); } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}

export { buildSkeleton, packetProbes, parseArguments, parseJsonc };
