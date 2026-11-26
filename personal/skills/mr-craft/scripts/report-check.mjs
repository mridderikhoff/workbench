#!/usr/bin/env node
import fs, { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { packetProbes } from './report-skeleton.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const packets = new Set(['angular', 'performance', 'correctness', 'architecture']);
const usage = 'Usage: node <skill-dir>/scripts/report-check.mjs [--root <dir>] [--packet <name|path>] <report file> [more report files]';
const placeholder = /(^[ \t]*TODO[ \t]*$|\|[ \t]*TODO[ \t]*\||^[ \t]*<!--[ \t]*unresolved:)/gm;
const probeIdentifier = /`([a-z][a-z-]*-\d+\.\d+)`/g;
const emptyForm = /^(?:no findings|not applicable|readiness pending|debt noted)\b/i;
const tableSeparator = /^:?-+:?$/;

function tableCells(line) {
  return line.split(/(?<!\\)\|/).slice(1, -1).map((cell) => cell.trim().replaceAll('\\|', '|'));
}

function reportMetadata(source) {
  const firstLine = source.split(/\r?\n/, 1)[0];
  const match = /^<!-- mr-craft-report: (\{.*\}) -->$/.exec(firstLine);
  if (!match) throw new Error('missing or malformed report metadata header');
  let metadata;
  try { metadata = JSON.parse(match[1]); }
  catch { throw new Error('malformed report metadata JSON'); }
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)
    || !packets.has(metadata.packet)
    || (metadata.section !== undefined && (metadata.packet !== 'angular' || !/^[1-9]\d*$/.test(metadata.section)))
    || Object.keys(metadata).some((key) => !['packet', 'section'].includes(key))) {
    throw new Error('invalid report metadata packet or section');
  }
  return metadata;
}

function checkReport(source, expectedProbes, metadata = reportMetadata(source)) {
  const problems = [];
  const expected = new Set(expectedProbes);
  const seen = new Set();
  const findingLocations = new Set();
  const additionChanges = [];
  let inTable = false;
  let section;
  let additionsLine;
  let additionsRows = 0;
  let additionsNone = false;
  let additionsTable = false;
  let changedFile = false;
  let coverageCount = 0;
  let declaredCoverage;

  for (const [index, line] of source.split(/\r?\n/).entries()) {
    if (/^## /.test(line)) {
      section = line;
      inTable = /^## (?:Findings|Coverage:)/.test(line);
      if (line === '## Additions') additionsLine = index + 1;
      if (/^## Coverage:/.test(line)) {
        coverageCount++;
        const match = /^## Coverage: (\d+) of (\d+) probes examined$/.exec(line);
        if (match) declaredCoverage = { answered: Number(match[1]), total: Number(match[2]) };
        else problems.push(`line ${index + 1}: malformed Coverage declaration`);
      }
      continue;
    }
    if (section === '## Files reviewed' && /^- `[^`]+` — changed(?:\s|$)/.test(line)) changedFile = true;
    if (section === '## Additions' && line.trim() === 'None') additionsNone = true;
    if (section === '## Additions' && line.startsWith('|')) {
      additionsTable = true;
      const cells = tableCells(line);
      if (cells[0] !== 'Addition (`file:line`)' && !tableSeparator.test(cells[0] ?? '')) {
        additionsRows++;
        if (cells.length !== 3) problems.push(`line ${index + 1}: Additions row requires 3 cells`);
        if (!['keep', 'delete', 'derive'].includes(cells[1])) problems.push(`line ${index + 1}: invalid Additions decision`);
        if (!cells[2]) problems.push(`line ${index + 1}: empty Additions reason`);
        const location = /`([^`]+:\d+)`/.exec(cells[0])?.[1];
        if (!location) problems.push(`line ${index + 1}: Additions row needs a file:line`);
        if (['delete', 'derive'].includes(cells[1]) && location) additionChanges.push({ location, line: index + 1 });
      }
    }
    if (!inTable || !line.startsWith('|')) continue;
    const cells = tableCells(line);
    if (cells.length < 4 || cells[0] === 'Probe' || tableSeparator.test(cells[0])) continue;
    if (section === '## Findings' && cells[2] && !emptyForm.test(cells[1])) {
      for (const match of cells[1].matchAll(/`([^`]+:\d+)`/g)) findingLocations.add(match[1]);
    }
    const identifiers = [...cells[0].matchAll(probeIdentifier)].map((match) => match[1]);
    if (identifiers.length === 0) {
      if (cells[0] !== 'TODO') problems.push(`line ${index + 1}: probe cell has no identifier`);
      continue;
    }
    for (const identifier of identifiers) {
      if (!expected.has(identifier)) problems.push(`line ${index + 1}: unknown probe ${identifier}`);
      if (seen.has(identifier)) problems.push(`line ${index + 1}: duplicate probe ${identifier}`);
      seen.add(identifier);
    }
    if (!cells[1]) problems.push(`line ${index + 1}: empty Finding cell`);
    if ((emptyForm.test(cells[1]) || !cells[2]) && !/^(?:no findings|not applicable|readiness pending|debt noted) — \S/.test(cells[1])) {
      problems.push(`line ${index + 1}: empty form lacks evidence or reason`);
    }
  }

  if (additionsLine && additionsRows === 0 && !additionsNone) problems.push(`line ${additionsLine}: Additions requires a data row or None`);
  if (additionsLine && additionsNone && (additionsRows || additionsTable)) problems.push(`line ${additionsLine}: Additions None must stand alone`);
  for (const change of additionChanges) {
    if (!findingLocations.has(change.location)) problems.push(`line ${change.line}: Additions ${change.location} needs a matching Findings row`);
  }
  if (metadata.packet === 'angular' && (!metadata.section || metadata.section === '2') && changedFile && !additionsLine) {
    problems.push('missing Additions section for changed angular section 2 files');
  }

  for (const identifier of expected) if (!seen.has(identifier)) problems.push(`missing probe ${identifier}`);
  const placeholderLines = new Set();
  for (const match of source.matchAll(placeholder)) {
    const line = source.slice(0, match.index).split('\n').length;
    placeholderLines.add(line);
  }
  for (const line of placeholderLines) problems.push(`line ${line}: TODO placeholder or unresolved import`);
  if (coverageCount !== 1) problems.push(`expected one Coverage declaration, found ${coverageCount}`);
  if (declaredCoverage && (declaredCoverage.answered !== seen.size || declaredCoverage.total !== expected.size)) {
    problems.push(`Coverage declares ${declaredCoverage.answered} of ${declaredCoverage.total}; report has ${seen.size} of ${expected.size}`);
  }
  return problems;
}

function checkReportFile(reportPath, context = {}) {
  const root = context.root ?? process.cwd();
  let source;
  try { source = readFileSync(path.resolve(root, reportPath), 'utf8'); }
  catch { return ['report is missing or unreadable']; }
  let metadata;
  try { metadata = reportMetadata(source); }
  catch (error) { return [error.message]; }
  const packetFile = context.packetFile ?? path.join(scriptDirectory, '../references/packets', `${metadata.packet}.md`);
  try { return checkReport(source, packetProbes(metadata.packet, metadata.section, packetFile), metadata); }
  catch (error) { return [`cannot load packet probes: ${error.message.split('\n')[0]}`]; }
}

function main() {
  const paths = process.argv.slice(2);
  let root = process.cwd();
  let packetFile;
  if (paths[0] === '--root') { root = path.resolve(paths[1]); paths.splice(0, 2); }
  if (paths[0] === '--packet') { packetFile = packets.has(paths[1]) ? path.join(scriptDirectory, '../references/packets', `${paths[1]}.md`) : path.resolve(paths[1]); paths.splice(0, 2); }
  if (paths.length === 0) {
    process.stderr.write(`${usage}\n`);
    process.exitCode = 1;
    return;
  }
  let failures = 0;
  for (const reportPath of paths) {
    const problems = checkReportFile(reportPath, { root, packetFile });
    for (const problem of problems) process.stderr.write(`${reportPath}: ${problem}\n`);
    if (problems.length) failures++;
  }
  if (failures) process.exitCode = 1;
  else process.stdout.write(`${paths.length} report${paths.length === 1 ? '' : 's'} checked\n`);
}

function isMainModule() {
  if (!process.argv[1]) return false;
  try {
    return fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isMainModule()) main();

export { checkReport, checkReportFile, reportMetadata };
