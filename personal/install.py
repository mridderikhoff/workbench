#!/usr/bin/env python3
"""Install the opt-in personal profile; never read credentials or session state."""
import argparse
import copy
import datetime
import json
import os
from pathlib import Path
import re
import shlex
import stat
import tomllib


def merge_dict(existing, preferences):
    result = copy.deepcopy(existing)
    for key, value in preferences.items():
        if isinstance(value, dict) and isinstance(result.get(key), dict):
            result[key] = merge_dict(result[key], value)
        else:
            result[key] = value
    return result


def merge_toml(existing, preferences):
    """Replace only managed scalar preferences, preserving servers and project trust."""
    original = tomllib.loads(existing)
    updates = {k: v for k, v in preferences.items() if not isinstance(v, dict)}
    tables = {f'[{k}]': v for k, v in preferences.items() if isinstance(v, dict)}
    managed = {'': updates, **tables}
    seen = {name: set() for name in managed}
    visited = {''}
    section = ''
    output = []

    def flush(name):
        for key, value in managed.get(name, {}).items():
            if key not in seen[name]:
                output.append(f'{key} = {json.dumps(value)}\n')
                seen[name].add(key)

    for line in existing.splitlines(keepends=True):
        heading = re.match(r'^\s*(\[.*\])\s*(?:#.*)?$', line)
        if heading:
            flush(section)
            section = heading.group(1)
            visited.add(section)
        assignment = re.match(r'^\s*([\w-]+)\s*=', line)
        key = assignment.group(1) if assignment else None
        if key in managed.get(section, {}):
            line = f'{key} = {json.dumps(managed[section][key])}\n'
            seen[section].add(key)
        output.append(line if line.endswith('\n') else line + '\n')
    flush(section)
    for name in tables:
        if name not in visited:
            output.append(f'\n{name}\n')
            flush(name)
    rendered = ''.join(output)
    expected = merge_dict(original, preferences)
    if tomllib.loads(rendered) != expected:
        raise ValueError('Cannot safely merge Codex config; existing config was left untouched')
    return rendered


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--home', type=Path, required=True)
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    home = args.home
    if not home.is_absolute():
        parser.error("--home must be an absolute path")
    kit = Path(__file__).resolve().parent
    stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f')
    actions = []

    def link(source, relative):
        target = home / relative
        if target.is_symlink() and target.resolve() == source.resolve():
            print(f'ok        {target}')
            return
        actions.append((target, source, None))

    def content(relative, data):
        target = home / relative
        if target.is_file() and not target.is_symlink() and target.read_text() == data:
            print(f'ok        {target}')
            return
        actions.append((target, None, data))

    for directory, dest in [('scripts', '.claude/scripts'), ('hooks', '.claude/hooks'), ('codex/hooks', '.codex/hooks')]:
        for source in sorted((kit / directory).iterdir()):
            if source.is_file():
                link(source, f'{dest}/{source.name}')
    link(kit / 'codex/hooks.json', '.codex/hooks.json')
    link(kit / 'codex/herdr-agent-state.sh', '.codex/herdr-agent-state.sh')
    link(kit / 'prompts/AGENTS.md', '.codex/AGENTS.md')
    link(kit / 'prompts/CLAUDE.md', '.claude/CLAUDE.md')
    link(kit / 'config/statusline-v2.mjs', '.claude/statusline-v2.mjs')
    for skill in json.loads((kit / 'skills.json').read_text()):
        source = kit / 'skills' / skill.get('canonical', skill['name'])
        for client in skill['clients']:
            link(source, f'.{client}/skills/{skill["name"]}')
    # Retired skills are archived, never deleted; keep removal repeatable and reversible.
    for skill in json.loads((kit / 'retired-skills.json').read_text()):
        for client in skill['clients']:
            target = home / f'.{client}/skills/{skill["name"]}'
            if os.path.lexists(target):
                actions.append((target, None, None))
    # Future agent definitions remain individual links, so unrelated agents survive.
    agents = kit / 'agents'
    if agents.exists():
        for client in sorted(agents.iterdir()):
            if client.is_dir():
                for source in sorted(client.iterdir()):
                    link(source, f'.{client.name}/agents/{source.name}')

    # Render commands using shell-quoted paths; preserve all unowned settings.
    preferences = json.loads((kit / 'config/claude-settings.json').read_text())
    for groups in preferences.get('hooks', {}).values():
        for group in groups:
            for hook in group['hooks']:
                command = hook['command']
                command = re.sub(r"'?\$\{HOME\}(/[^'\s]+)'?", lambda m: shlex.quote(str(home) + m.group(1)), command)
                hook['command'] = command
    preferences['statusLine']['command'] = 'node ' + shlex.quote(str(home / '.claude/statusline-v2.mjs'))
    settings_path = home / '.claude/settings.json'
    existing_settings = json.loads(settings_path.read_text()) if settings_path.exists() else {}
    content('.claude/settings.json', json.dumps(merge_dict(existing_settings, preferences), indent=2) + '\n')
    config_path = home / '.codex/config.toml'
    existing_config = config_path.read_text() if config_path.exists() else ''
    content('.codex/config.toml', merge_toml(existing_config, tomllib.loads((kit / 'config/codex-config.toml').read_text())))

    # Validate all generated files and sources before changing any personal files.
    for target, source, data in actions:
        if source is not None and not source.exists():
            raise FileNotFoundError(source)
    for target, source, data in actions:
        mode = stat.S_IMODE(target.stat().st_mode) if data is not None and target.is_file() else 0o600
        if os.path.lexists(target):
            retired = source is None and data is None
            if retired:
                client = target.relative_to(home).parts[0].lstrip('.')
                backup = home / '.local/state/workbench/retired-skills' / client / (target.name + '.bak-' + stamp)
            else:
                backup = target.with_name(target.name + '.bak-' + stamp)
            backup_base = backup
            suffix = 0
            while os.path.lexists(backup):
                suffix += 1
                backup = backup_base.with_name(backup_base.name + f'-{suffix}')
            print(f'{"would back up" if args.dry_run else "backed up"} {target} -> {backup}')
            if not args.dry_run:
                backup.parent.mkdir(parents=True, exist_ok=True)
                target.rename(backup)
        if source is None and data is None:
            print(f'{"would retire" if args.dry_run else "retired"} {target}')
            continue
        print(f'{"would link" if args.dry_run else "linked"} {target} -> {source}' if source else f'{"would merge" if args.dry_run else "merged"} {target}')
        if not args.dry_run:
            target.parent.mkdir(parents=True, exist_ok=True)
            if source:
                target.symlink_to(source, target_is_directory=source.is_dir())
            else:
                descriptor = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, mode)
                with os.fdopen(descriptor, "w") as stream:
                    stream.write(data)
                target.chmod(mode)


if __name__ == '__main__':
    main()
