#!/usr/bin/env python3
"""Focused installer checks; all writes stay in a temporary home, no services."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import tomllib
import unittest

REPO = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('personal_install', REPO / 'personal/install.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class InstallProfiles(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='overseer install ')
        self.addCleanup(self.temp.cleanup)
        self.home = Path(self.temp.name) / "person's home"
        self.home.mkdir()

    def install(self, *args, success=True):
        env = dict(os.environ, OVERSEER_INSTALL_HOME=str(self.home),
                   OVERSEER_CONFIG_FILE=str(self.home / 'no-runtime.env'), PYTHONDONTWRITEBYTECODE='1')
        result = subprocess.run([str(REPO / 'install.sh'), *args], env=env, text=True, capture_output=True, timeout=20)
        self.assertEqual(result.returncode == 0, success, result.stdout + result.stderr)
        return result

    def write(self, path, data):
        target = self.home / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(data)
        return target

    def snapshot(self):
        return {str(p.relative_to(self.home)): ('link', os.readlink(p)) if p.is_symlink()
                else ('file', p.read_bytes()) if p.is_file() else ('dir', None)
                for p in self.home.rglob('*') if not any(q.is_symlink() for q in p.parents if q != self.home)}

    def test_default_only_installs_runtime(self):
        hook = self.write('.claude/hooks/existing', 'keep')
        settings = self.write('.claude/settings.json', '{"custom": true}')
        self.install()
        self.assertTrue((self.home / '.claude/bin/wt').is_symlink())
        self.assertFalse((self.home / '.codex').exists())
        self.assertFalse((self.home / '.claude/CLAUDE.md').exists())
        self.assertFalse((self.home / '.claude/skills').exists())
        self.assertEqual(hook.read_text(), 'keep')
        self.assertEqual(settings.read_text(), '{"custom": true}')

    def test_alias_preserves_existing_codex(self):
        config = self.write('.codex/config.toml', 'model = "keep"\n')
        self.install('--runtime-only')
        self.assertTrue((self.home / '.codex/bin/wt').is_symlink())
        self.assertEqual(config.read_text(), 'model = "keep"\n')
        self.assertFalse((self.home / '.codex/hooks.json').exists())

    def test_dry_runs_write_nothing_including_broken_links(self):
        target = self.home / '.claude/bin/wt'
        target.parent.mkdir(parents=True)
        target.symlink_to(self.home / 'missing')
        before = self.snapshot()
        for args in [(), ('--runtime-only',), ('--personal',)]:
            result = self.install(*args, '--dry-run')
            self.assertIn('would back up', result.stdout)
            self.assertEqual(self.snapshot(), before)

    def test_personal_links_and_merges_preserving_local_config(self):
        self.write('.claude/settings.json', json.dumps({'env': {'KEEP_THIS': 'local'}, 'custom': True}))
        self.write('.codex/config.toml', 'model = "old"\n[mcp_servers.local]\nurl = "http://localhost:7777"\n[features]\nother = true\n[projects."/local"]\ntrust_level = "trusted"\n')
        self.install('--personal')
        for path in ['.claude/CLAUDE.md', '.codex/AGENTS.md', '.claude/hooks/block-inline-checkout-edits.py', '.claude/scripts/codex-run', '.codex/hooks.json']:
            self.assertTrue((self.home / path).is_symlink(), path)
            self.assertTrue((self.home / path).exists(), path)
        for client in ['agents', 'claude', 'codex']:
            skill = self.home / f'.{client}/skills/orchestrate'
            self.assertTrue(skill.is_symlink())
            self.assertFalse((self.home / f'.{client}/skills/manager-mode').exists())
        settings = json.loads((self.home / '.claude/settings.json').read_text())
        self.assertTrue(settings['custom'])
        self.assertEqual(settings['env']['KEEP_THIS'], 'local')
        for event in settings['hooks'].values():
            for group in event:
                for hook in group['hooks']:
                    self.assertNotIn('/home/marica/', hook['command'])
                    import shlex
                    command = shlex.split(hook['command'])
                    self.assertTrue(Path(command[1]).exists(), hook['command'])
        config = tomllib.loads((self.home / '.codex/config.toml').read_text())
        self.assertEqual(config['mcp_servers']['local']['url'], 'http://localhost:7777')
        self.assertTrue(config['features']['hooks'])
        self.assertTrue(config['features']['other'])
        self.assertEqual(config['projects']['/local']['trust_level'], 'trusted')
        before = self.snapshot()
        self.install('--personal')
        self.assertEqual(self.snapshot(), before)

    def test_backups_preserve_files_directories_and_broken_links(self):
        prompt = self.write('.codex/AGENTS.md', 'original prompt')
        skill = self.home / '.agents/skills/handoff'
        skill.mkdir(parents=True)
        (skill / 'local.md').write_text('local skill')
        broken = self.home / '.claude/CLAUDE.md'
        broken.parent.mkdir(parents=True)
        broken.symlink_to(self.home / 'absent')
        self.install('--personal')
        self.assertEqual(next(prompt.parent.glob('AGENTS.md.bak-*')).read_text(), 'original prompt')
        self.assertEqual((next(skill.parent.glob('handoff.bak-*')) / 'local.md').read_text(), 'local skill')
        backup = next(broken.parent.glob('CLAUDE.md.bak-*'))
        self.assertTrue(backup.is_symlink())
        self.assertEqual(os.readlink(backup), str(self.home / 'absent'))

    def test_conflicting_flags_refused_before_writes(self):
        before = self.snapshot()
        self.install('--personal', '--runtime-only', success=False)
        self.assertEqual(self.snapshot(), before)

    def test_invalid_personal_config_prevents_personal_changes(self):
        self.write('.codex/config.toml', 'invalid toml!')
        self.install('--personal', success=False)
        self.assertFalse((self.home / '.claude/CLAUDE.md').exists())
        self.assertFalse((self.home / '.codex/AGENTS.md').exists())

    def test_settings_keep_private_file_permissions(self):
        config = self.write('.codex/config.toml', 'model="old"\n')
        settings = self.write('.claude/settings.json', '{}')
        config.chmod(0o600)
        settings.chmod(0o640)
        self.install('--personal')
        self.assertEqual(config.stat().st_mode & 0o777, 0o600)
        self.assertEqual(settings.stat().st_mode & 0o777, 0o640)

    def test_retired_skills_are_archived_only_by_personal_install(self):
        names = ['manager-mode', 'pr-backend-review-artifact', 'skill-harden', 'find-skills']
        for client in ['claude', 'agents', 'codex']:
            for name in names:
                if name == 'manager-mode':
                    target = self.home / f'.{client}/skills/{name}'
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.symlink_to(self.home / 'missing-alias')
                else:
                    self.write(f'.{client}/skills/{name}/SKILL.md', f'original {client}/{name}')
        before = self.snapshot()
        self.install('--personal', '--dry-run')
        self.assertEqual(self.snapshot(), before)
        self.install()
        for client in ['claude', 'agents', 'codex']:
            for name in names:
                self.assertTrue(os.path.lexists(self.home / f'.{client}/skills/{name}'))
        self.install('--personal')
        for client in ['claude', 'agents', 'codex']:
            for name in names:
                target = self.home / f'.{client}/skills/{name}'
                self.assertFalse(os.path.lexists(target))
                backups = list((self.home / '.local/state/workbench/retired-skills' / client).glob(name + '.bak-*'))
                self.assertEqual(list(target.parent.glob(name + '.bak-*')), [])
                self.assertEqual(len(backups), 1)
                if name == 'manager-mode':
                    self.assertTrue(backups[0].is_symlink())
                else:
                    self.assertEqual((backups[0] / 'SKILL.md').read_text(), f'original {client}/{name}')
        for name in ['codex-implementation', 'codex-review', 'codex-computer-use', 'cross-review']:
            self.assertTrue((self.home / f'.claude/skills/{name}/SKILL.md').exists())
        after = self.snapshot()
        self.install('--personal')
        self.assertEqual(self.snapshot(), after)

    def test_toml_merge_handles_section_positions(self):
        preferences = {'model': 'new', 'features': {'hooks': True}, 'agents': {'default_subagent_model': 'preferred'}, 'tui': {'status_line': ['model']}}
        for existing in ['', 'model="old"', '[features]\nhooks=false\n', '[features]\nother=true\n[mcp_servers.x]\nurl="local"\n', 'model="old"\n[mcp_servers.x]\nurl="local"\n']:
            with self.subTest(existing=existing):
                actual = tomllib.loads(module.merge_toml(existing, preferences))
                self.assertEqual(actual, module.merge_dict(tomllib.loads(existing), preferences))


if __name__ == '__main__':
    unittest.main()
