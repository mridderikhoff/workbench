#!/usr/bin/env python3
"""Validated repository settings for wt and its status reader."""
import json
import hashlib
import os
import pathlib
import re
import sys

BUILTINS = {
    'ds-demo': dict(label='DS demo', portBase=5175, cwd='apps/ui', command='pnpm exec nx serve ds-demo --port {port}', urlPath='/', backend=False),
    'ri': dict(label='RI', portBase=5174, cwd='apps/ui', command='CI=true PORT_OFFSET={offset} pnpm exec nx serve ri --port {port}', urlPath='/{tenant}/ri/', backend=True),
    'strategy': dict(label='Strategy', portBase=5173, cwd='apps/ui', command='CI=true PORT_OFFSET={offset} pnpm exec nx serve strategy --port {port}', urlPath='/{tenant}', backend=True),
}


FALLBACK = dict(name='cl-strategy', baseBranch='develop', deps=[], nodeModules='apps/ui',
                backend=True, nxSharedCache=True, defaultApps=['ds-demo', 'ri'], apps=BUILTINS)


def profile_dir():
    return pathlib.Path(os.environ.get('WT_PROFILE_DIR', '~/.config/wt/profiles')).expanduser()


def warn_invalid(file, error):
    marker_dir = os.environ.get('WT_PROFILE_WARNING_DIR')
    if marker_dir:
        marker = pathlib.Path(marker_dir) / hashlib.sha256(str(file).encode()).hexdigest()
        try:
            descriptor = os.open(marker, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        except FileExistsError:
            return
        os.close(descriptor)
    message = str(error)
    if not message.startswith('bad wt profile '):
        message = f'bad wt profile {file}: {message}'
    print(f'wt: warning: {message}', file=sys.stderr)


def read_profile(file):
    try:
        data = json.loads(file.read_text())
        def check_controls(value, key):
            if isinstance(value, str):
                if any(ord(char) < 32 or ord(char) == 127 for char in value):
                    raise ValueError(f'{key} must not contain control characters')
            elif isinstance(value, dict):
                for child, nested in value.items():
                    check_controls(child, f'{key} key')
                    check_controls(nested, f'{key}.{child}')
            elif isinstance(value, list):
                for index, nested in enumerate(value):
                    check_controls(nested, f'{key}[{index}]')
        check_controls(data, 'profile')
        def safe_string(value, key):
            if not isinstance(value, str) or any(ord(char) < 32 or ord(char) == 127 for char in value):
                raise ValueError(f'{key} must be a string without control characters')
        required = ('name', 'checkout', 'baseBranch', 'deps', 'nodeModules', 'backend', 'nxSharedCache', 'defaultApps', 'apps')
        if not isinstance(data, dict) or any(key not in data for key in required):
            raise ValueError('missing required fields')
        for key in ('name', 'baseBranch', 'nodeModules'):
            safe_string(data[key], key)
        safe_string(data['checkout'], 'checkout')
        if (any(char in data['checkout'] for char in "\\\"'")
                or (data['checkout'].startswith('~') and not data['checkout'].startswith('~/'))
                or not pathlib.Path(data['checkout']).expanduser().is_absolute()):
            raise ValueError('checkout must be an absolute path without backslashes or quotes')
        if not re.fullmatch(r'[a-z0-9][a-z0-9-]*', data['name']):
            raise ValueError('name must use lowercase letters, digits and hyphens')
        if not isinstance(data['baseBranch'], str) or not data['baseBranch'] or data['baseBranch'].startswith('-'):
            raise ValueError('invalid baseBranch')
        for key in ('backend', 'nxSharedCache'):
            if type(data[key]) is not bool: raise ValueError(f'{key} must be boolean')
        if 'gates' in data:
            safe_string(data['gates'], 'gates')
            if not data['gates'] or any(char in data['gates'] for char in "\\\"'"):
                raise ValueError('gates must be a nonempty command without backslashes or quotes')
        for key in ('deps', 'defaultApps'):
            if not isinstance(data[key], list) or any(not isinstance(x, str) for x in data[key]):
                raise ValueError(f'{key} must be a string array')
            for value in data[key]: safe_string(value, key)
        def relative(value, key):
            safe_string(value, key)
            if not value or '\\' in value or pathlib.PurePosixPath(value).is_absolute() or '..' in pathlib.PurePosixPath(value).parts:
                raise ValueError(f'{key} must be a relative path')
        relative(data['nodeModules'], 'nodeModules')
        for dep in data['deps']: relative(dep, 'deps')
        if not isinstance(data['apps'], dict) or not data['apps']:
            raise ValueError('apps must be a nonempty object')
        for name, app in data['apps'].items():
            safe_string(name, 'app name')
            if (name in BUILTINS and data['name'] != 'cl-strategy') or not re.fullmatch(r'[a-z0-9][a-z0-9-]{0,31}', name):
                raise ValueError(f'invalid or built-in app name: {name}')
            if not isinstance(app, dict) or any(k not in app for k in ('label', 'portBase', 'cwd', 'command', 'urlPath', 'backend')):
                raise ValueError(f'{name}: missing app fields')
            relative(app['cwd'], f'{name}.cwd')
            for key in ('label', 'command', 'urlPath'):
                safe_string(app[key], f'{name}.{key}')
            if any(char in app['command'] for char in "\\\"'") or "'" in app['cwd']:
                raise ValueError(f"{name}: command must not contain backslashes or quotes; cwd must not contain a single quote")
            if not isinstance(app['label'], str) or not app['label'] or type(app['portBase']) is not int or not 1 <= app['portBase'] <= 65535 - 90:
                raise ValueError(f'{name}: invalid label or portBase')
            if not isinstance(app['command'], str) or '{port}' not in app['command'] or not isinstance(app['urlPath'], str) or not app['urlPath'].startswith('/') or type(app['backend']) is not bool:
                raise ValueError(f'{name}: invalid command, urlPath or backend')
        if any(app not in data['apps'] for app in data['defaultApps']):
            raise ValueError('defaultApps contains an unknown app')
        return data
    except (OSError, ValueError, TypeError, json.JSONDecodeError) as error:
        raise ValueError(f'bad wt profile {file}: {error}') from error


def profiles():
    found = []
    names, checkouts = {}, {}
    for file in sorted(profile_dir().glob('*.json')):
        try:
            data = read_profile(file)
        except ValueError as error:
            warn_invalid(file, error)
            continue
        try:
            checkout = str(pathlib.Path(data['checkout']).expanduser().resolve())
        except (OSError, RuntimeError) as error:
            warn_invalid(file, error)
            continue
        for key, value, seen in (('name', data['name'], names), ('checkout', checkout, checkouts)):
            if value in seen:
                raise ValueError(f'duplicate profile {key} {value}: {seen[value]} and {file}')
            seen[value] = file
        found.append((file, data, checkout))
    return found


def profile(root):
    if not root:
        raise ValueError('profile root is empty')
    checkout = str(pathlib.Path(root).resolve())
    for _, data, candidate in profiles():
        if candidate == checkout:
            return data
    return FALLBACK


def profile_directory(root):
    checkout = str(pathlib.Path(root).resolve())
    for file, _, candidate in profiles():
        if candidate == checkout:
            return str(file.resolve().parent)
    return ''


if __name__ == '__main__':
    try:
        action = sys.argv[2]
        if action == 'known':
            found = sorted(profiles(), key=lambda item: (item[1]['name'] != 'cl-strategy', item[1]['name']))
            print('\n'.join(item[2] for item in found))
            sys.exit(0)
        data = profile(sys.argv[1])
        if action == 'profileDir': print(profile_directory(sys.argv[1]))
        elif action == 'gates': print(data.get('gates', ''))
        elif action == 'json': print(json.dumps(data))
        elif action == 'apps': print(' '.join(data['apps']))
        elif action == 'defaultApps': print(' '.join(data['defaultApps']))
        elif action == 'deps': print('\n'.join(data['deps']))
        elif action == 'app':
            app = data['apps'].get(sys.argv[3])
            if app is None: raise ValueError(f"{data['name']} apps: {', '.join(data['apps'])}; unknown app {sys.argv[3]}")
            value = app[sys.argv[4]]
            print(str(value).lower() if type(value) is bool else value)
        else:
            value = data[action]
            print(str(value).lower() if type(value) is bool else value)
    except (ValueError, KeyError, IndexError) as error:
        print(f'wt: {error}', file=sys.stderr)
        sys.exit(2)
