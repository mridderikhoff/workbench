#!/usr/bin/env python3
"""Validated repository settings for wt and its status reader."""
import json
import pathlib
import re
import sys

BUILTINS = {
    'ds-demo': dict(label='DS demo', portBase=5175, cwd='apps/ui', command='pnpm exec nx serve ds-demo --port {port}', urlPath='/', backend=False),
    'ri': dict(label='RI', portBase=5174, cwd='apps/ui', command='CI=true PORT_OFFSET={offset} pnpm exec nx serve ri --port {port}', urlPath='/{tenant}/ri/', backend=True),
    'strategy': dict(label='Strategy', portBase=5173, cwd='apps/ui', command='CI=true PORT_OFFSET={offset} pnpm exec nx serve strategy --port {port}', urlPath='/{tenant}', backend=True),
}


def profile(root):
    if not root:
        raise ValueError('profile root is empty')
    file = pathlib.Path(root) / '.workbench/wt.json'
    if not file.exists():
        return dict(name='cl-strategy', baseBranch='develop', deps=[], nodeModules='apps/ui',
                    backend=True, nxSharedCache=True, defaultApps=['ds-demo', 'ri'], apps=BUILTINS)
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
        required = ('name', 'baseBranch', 'deps', 'nodeModules', 'backend', 'nxSharedCache', 'defaultApps', 'apps')
        if not isinstance(data, dict) or any(key not in data for key in required):
            raise ValueError('missing required fields')
        for key in ('name', 'baseBranch', 'nodeModules'):
            safe_string(data[key], key)
        if not re.fullmatch(r'[a-z0-9][a-z0-9-]*', data['name']):
            raise ValueError('name must use lowercase letters, digits and hyphens')
        if not isinstance(data['baseBranch'], str) or not data['baseBranch'] or data['baseBranch'].startswith('-'):
            raise ValueError('invalid baseBranch')
        for key in ('backend', 'nxSharedCache'):
            if type(data[key]) is not bool: raise ValueError(f'{key} must be boolean')
        for key in ('deps', 'defaultApps'):
            if not isinstance(data[key], list) or any(not isinstance(x, str) for x in data[key]):
                raise ValueError(f'{key} must be a string array')
            for value in data[key]: safe_string(value, key)
        def relative(value, key):
            safe_string(value, key)
            if not value or pathlib.PurePosixPath(value).is_absolute() or '..' in pathlib.PurePosixPath(value).parts:
                raise ValueError(f'{key} must be a relative path')
        relative(data['nodeModules'], 'nodeModules')
        for dep in data['deps']: relative(dep, 'deps')
        if not isinstance(data['apps'], dict) or not data['apps']:
            raise ValueError('apps must be a nonempty object')
        for name, app in data['apps'].items():
            safe_string(name, 'app name')
            if name in BUILTINS or not re.fullmatch(r'[a-z0-9][a-z0-9-]{0,31}', name):
                raise ValueError(f'invalid or built-in app name: {name}')
            if not isinstance(app, dict) or any(k not in app for k in ('label', 'portBase', 'cwd', 'command', 'urlPath', 'backend')):
                raise ValueError(f'{name}: missing app fields')
            relative(app['cwd'], f'{name}.cwd')
            for key in ('label', 'command', 'urlPath'):
                safe_string(app[key], f'{name}.{key}')
            if "'" in app['command'] or "'" in app['cwd']:
                raise ValueError(f"{name}: command and cwd must not contain a single quote")
            if not isinstance(app['label'], str) or not app['label'] or type(app['portBase']) is not int or not 1 <= app['portBase'] <= 65535 - 90:
                raise ValueError(f'{name}: invalid label or portBase')
            if not isinstance(app['command'], str) or '{port}' not in app['command'] or not isinstance(app['urlPath'], str) or not app['urlPath'].startswith('/') or type(app['backend']) is not bool:
                raise ValueError(f'{name}: invalid command, urlPath or backend')
        if any(app not in data['apps'] for app in data['defaultApps']):
            raise ValueError('defaultApps contains an unknown app')
        return data
    except (OSError, ValueError, TypeError, json.JSONDecodeError) as error:
        raise ValueError(f'bad wt profile {file}: {error}') from error


if __name__ == '__main__':
    try:
        data = profile(sys.argv[1])
        action = sys.argv[2]
        if action == 'json': print(json.dumps(data))
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
