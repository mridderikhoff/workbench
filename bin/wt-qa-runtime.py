#!/usr/bin/env python3
"""Reconcile a managed QA runtime after an explicit wt qa attach."""

from __future__ import annotations

import json
import os
import re
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path


SERVICES = (
    "azurite", "keycloak", "functions", "langgraph", "backend",
    "frontend-strategy", "frontend-ri", "ds-demo",
)
UI_SERVICES = ("frontend-strategy", "frontend-ri", "ds-demo")
APP_SERVICES = SERVICES[:-1]
GROUPS = {"app": APP_SERVICES, "ds-demo": ("ds-demo",)}
PYTHON_WORKSPACES = {
    "backend": "apps/backend",
    "functions": "apps/functions",
    "langgraph": "apps/strategy-graph",
}
UNIT_PREFIX = "cl-strategy-qa-"
READINESS_TIMEOUT = 120
ANSI_ESCAPE = re.compile(r"\x1b\[[0-9;]*m")


@dataclass(frozen=True)
class ChangePlan:
    ui_dependencies: bool
    ui_changed: tuple[str, ...]
    python_dependencies: tuple[str, ...]
    restart: tuple[str, ...]


def plan_changes(files: list[str]) -> ChangePlan:
    ui_dependencies = False
    ui_changed: set[str] = set()
    python_dependencies: set[str] = set()
    restart: set[str] = set()
    for file in files:
        if file.startswith("apps/ui/"):
            if file.endswith(("/package.json", "/pnpm-lock.yaml", "/pnpm-workspace.yaml")):
                ui_dependencies = True
            elif file.endswith((".spec.ts", ".test.ts", ".md")):
                continue
            elif file.startswith(("apps/ui/apps/ri/", "apps/ui/libs/ri/")):
                ui_changed.add("frontend-ri")
            elif file.startswith("apps/ui/libs/ds/"):
                ui_changed.update(("frontend-ri", "ds-demo"))
            elif file.startswith(("apps/ui/apps/strategy/", "apps/ui/libs/strategy/")):
                ui_changed.add("frontend-strategy")
            elif file.startswith("apps/ui/apps/ds-demo/"):
                ui_changed.add("ds-demo")
            else:
                ui_changed.update(UI_SERVICES)
        for service, workspace in PYTHON_WORKSPACES.items():
            if file in (f"{workspace}/uv.lock", f"{workspace}/pyproject.toml"):
                python_dependencies.add(service)
                restart.add(service)
            elif file.startswith(f"{workspace}/"):
                if service in ("functions", "langgraph"):
                    restart.add(service)
        if file.startswith("libs/common/"):
            python_dependencies.update(PYTHON_WORKSPACES)
            restart.update(PYTHON_WORKSPACES)
    if ui_dependencies:
        restart.update(UI_SERVICES)
    return ChangePlan(
        ui_dependencies, tuple(sorted(ui_changed)), tuple(sorted(python_dependencies)), tuple(sorted(restart))
    )


class RuntimeErrorWithContext(RuntimeError):
    pass


class InstallFailure(RuntimeErrorWithContext):
    pass


class ReadinessFailure(RuntimeErrorWithContext):
    pass


class Runtime:
    def __init__(self, qa: Path):
        self.qa = qa.resolve()

    def command(self, *args: str, cwd: Path | None = None, env: dict[str, str] | None = None) -> str:
        import os

        result = subprocess.run(
            args, cwd=cwd, env={**os.environ, **(env or {})},
            capture_output=True, text=True, timeout=180, check=False,
        )
        if result.returncode:
            raise RuntimeErrorWithContext(
                f"{' '.join(args)} failed ({result.returncode}): {result.stderr.strip() or result.stdout.strip()}"
            )
        return result.stdout.strip()

    def changed_files(self, before: str, after: str) -> list[str]:
        if before == after:
            return []
        return self.command("git", "-C", str(self.qa), "diff", "--name-only", before, after).splitlines()

    def state_path(self) -> Path:
        git_directory = self.command("git", "-C", str(self.qa), "rev-parse", "--absolute-git-dir")
        return Path(git_directory) / "wt-qa-reconciled.json"

    def reconciled_commits(self, before: str, stack: str) -> dict[str, str]:
        path = self.state_path()
        try:
            stored = json.loads(path.read_text()) if path.exists() else {}
        except (OSError, ValueError) as exc:
            raise RuntimeErrorWithContext(f"cannot read QA reconciliation state at {path}: {exc}") from exc
        if not isinstance(stored, dict):
            raise RuntimeErrorWithContext(f"invalid QA reconciliation state at {path}")
        commits: dict[str, str] = {}
        for group in GROUPS:
            commit = stored.get(group, before)
            if group not in selected_groups(stack):
                commits[group] = commit
                continue
            if not isinstance(commit, str) or not re.fullmatch(r"[0-9a-f]{40}", commit):
                raise RuntimeErrorWithContext(f"invalid {group} commit in QA reconciliation state")
            resolved = self.command(
                "git", "-C", str(self.qa), "rev-parse", "--verify", "--quiet", f"{commit}^{{commit}}"
            )
            if resolved != commit:
                raise RuntimeErrorWithContext(f"{group} QA reconciliation commit is unavailable: {commit}")
            commits[group] = commit
        if not path.exists():
            self.write_reconciled_commits(commits)
        return commits

    def write_reconciled_commits(self, commits: dict[str, str]) -> None:
        path = self.state_path()
        temporary = path.with_name(f"{path.name}.{os.getpid()}.tmp")
        try:
            temporary.write_text(json.dumps(commits, sort_keys=True) + "\n")
            temporary.replace(path)
        finally:
            temporary.unlink(missing_ok=True)

    def changes_since_reconciliation(self, before: str, after: str, stack: str) -> tuple[ChangePlan, dict[str, str]]:
        commits = self.reconciled_commits(before, stack)
        files = set(self.changed_files(before, after))
        for group in selected_groups(stack):
            files.update(self.changed_files(commits[group], after))
        return plan_changes(sorted(files)), commits

    def unit(self, service: str) -> str:
        return f"{UNIT_PREFIX}{service}.service"

    def loaded(self, service: str) -> bool:
        return self.command("systemctl", "--user", "show", "-p", "LoadState", "--value", self.unit(service)) == "loaded"

    def active(self, service: str) -> bool:
        return subprocess.run(
            ("systemctl", "--user", "is-active", "--quiet", self.unit(service)),
            capture_output=True, timeout=5, check=False,
        ).returncode == 0

    def control(self, verb: str, service: str) -> None:
        self.command("systemctl", "--user", verb, self.unit(service))
        print(f"runtime    {verb} {service}", flush=True)

    def port_map(self) -> dict:
        return json.loads(self.command("python3", "scripts/dev/ports.py", "--json", cwd=self.qa))

    def ds_demo_port(self) -> int:
        project = self.qa / "apps/ui/apps/ds-demo/project.json"
        return int(json.loads(project.read_text())["targets"]["serve"]["options"]["port"])

    def tcp_ready(self, port: int) -> bool:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=1):
                return True
        except OSError:
            return False

    def http_ready(self, port: int, path: str, *, javascript: bool = False) -> bool:
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{port}{path}", timeout=2) as response:
                content_type = response.headers.get("Content-Type", "").lower()
                if javascript:
                    return response.status == 200 and ("javascript" in content_type or "ecmascript" in content_type)
                return response.status == 200
        except (OSError, urllib.error.URLError):
            return False

    def bundle_complete(self, service: str, since: str) -> bool:
        since_microseconds = int(since)
        since_seconds = datetime.fromtimestamp(since_microseconds / 1_000_000).strftime("%Y-%m-%d %H:%M:%S")
        result = subprocess.run(
            ("journalctl", "--user", "-u", self.unit(service), "--since", since_seconds,
             "--no-pager", "-o", "json"),
            capture_output=True, text=True, timeout=5, check=False,
        )
        if result.returncode:
            return False
        latest_outcome = None
        for line in result.stdout.splitlines():
            try:
                entry = json.loads(line)
                if int(entry.get("__REALTIME_TIMESTAMP", 0)) < since_microseconds:
                    continue
                raw_message = entry.get("MESSAGE", "")
                if isinstance(raw_message, list):
                    message = bytes(raw_message).decode("utf-8", errors="replace")
                else:
                    message = str(raw_message)
                message = ANSI_ESCAPE.sub("", message)
            except (ValueError, TypeError):
                continue
            if any(marker in message for marker in (
                "Application bundle generation failed", "✘ [ERROR]", "Failed to compile",
                "Changes detected. Rebuilding", "Building...",
            )):
                latest_outcome = False
            elif any(marker in message for marker in ("Application bundle generation complete", "Compiled successfully")):
                latest_outcome = True
        return latest_outcome is True

    def preflight(self, stack: str) -> None:
        for service in selected_services(stack):
            if not self.loaded(service):
                raise RuntimeErrorWithContext(
                    f"QA unit {self.unit(service)} is missing; run ~/.claude/bin/qa-stack up "
                    f"(units serving {self.qa}), then retry"
                )
            directory = self.command(
                "systemctl", "--user", "show", "-p", "WorkingDirectory", "--value", self.unit(service)
            )
            expected = self.qa / "apps/ui" if service == "ds-demo" else self.qa
            if Path(directory).resolve() != expected:
                raise RuntimeErrorWithContext(f"QA unit {self.unit(service)} serves {directory}, not {expected}")
        if "ds-demo" in selected_services(stack) and not self.active("ds-demo") and self.tcp_ready(self.ds_demo_port()):
            raise RuntimeErrorWithContext(
                f"ds-demo is live on port {self.ds_demo_port()} outside its QA unit; "
                "stop that terminal session, run ~/.claude/bin/qa-stack up, then retry"
            )

    def install(self, workspace: str, command: tuple[str, ...], stopped: list[str], services: tuple[str, ...]) -> None:
        for service in services:
            if self.active(service):
                self.control("stop", service)
                stopped.append(service)
        print(f"deps       installing {workspace}", flush=True)
        try:
            self.command(*command, cwd=self.qa / workspace, env={"CI": "true"})
        except (RuntimeErrorWithContext, subprocess.TimeoutExpired) as exc:
            raise InstallFailure(str(exc)) from exc

    def ready(self, service: str, ports: dict, since: str | None = None) -> bool:
        if not self.active(service):
            return False
        shared = ports.get("shared", {})
        service_ports = ports.get("services", {})
        frontend_ports = ports.get("frontendPorts", {})
        if service == "azurite":
            return all(self.tcp_ready(shared[name]) for name in ("azurite_blob", "azurite_queue", "azurite_table"))
        if service == "keycloak":
            return self.http_ready(shared["keycloak"], "/realms/master/.well-known/openid-configuration")
        if service == "functions":
            return self.http_ready(service_ports["functions"], "/api/readyz")
        if service == "langgraph":
            return self.http_ready(service_ports["langgraph"], "/ok")
        if service == "backend":
            return self.http_ready(service_ports["backend"], "/readyz")
        if service in UI_SERVICES:
            port = self.ds_demo_port() if service == "ds-demo" else frontend_ports[service.removeprefix("frontend-")]
            return (
                self.http_ready(port, "/")
                and self.http_ready(port, "/main.js", javascript=True)
                and (since is None or self.bundle_complete(service, since))
            )
        return False

    def wait_ready(self, service: str, ports: dict, since: str | None = None) -> None:
        deadline = time.monotonic() + READINESS_TIMEOUT
        while time.monotonic() < deadline:
            if self.ready(service, ports, since):
                print(f"ready      {service}", flush=True)
                return
            time.sleep(2)
        raise ReadinessFailure(f"{service} did not become ready within {READINESS_TIMEOUT}s")

    def status(self, stack: str) -> None:
        ports = None
        for group in selected_groups(stack):
            print(f"{group}:")
            for service in GROUPS[group]:
                if not self.active(service):
                    print(f"  {service:<18} inactive")
                    continue
                try:
                    if service == "ds-demo":
                        ready = self.ready(service, {})
                    else:
                        if ports is None:
                            ports = self.port_map()
                        ready = self.ready(service, ports)
                except (RuntimeErrorWithContext, KeyError, ValueError, OSError):
                    ready = False
                print(f"  {service:<18} {'ready' if ready else 'active, not ready'}")

    def reconcile(self, plan: ChangePlan, since: str, stack: str) -> None:
        selected = selected_services(stack)
        stopped: list[str] = []
        changed = set(plan.restart) & set(selected)
        failures: list[Exception] = []
        try:
            if plan.ui_dependencies:
                self.install(
                    "apps/ui", ("pnpm", "install", "--frozen-lockfile", "--prefer-offline"),
                    stopped, UI_SERVICES,
                )
                changed.update(set(UI_SERVICES) & set(selected))
            for service in plan.python_dependencies:
                if service in selected:
                    self.install(
                        PYTHON_WORKSPACES[service], ("uv", "sync", "--all-extras"), stopped, (service,),
                    )
        except Exception as install_error:
            restoration_errors: list[Exception] = []
            for service in stopped:
                if not self.active(service):
                    try:
                        self.control("start", service)
                    except Exception as exc:
                        restoration_errors.append(exc)
            if restoration_errors:
                raise RuntimeErrorWithContext(
                    f"{install_error}; restoration failed: "
                    + "; ".join(str(error) for error in restoration_errors)
                ) from install_error
            raise
        restoration_errors: list[Exception] = []
        for service in stopped:
            if service not in selected and not self.active(service):
                try:
                    self.control("start", service)
                except Exception as exc:
                    restoration_errors.append(exc)
        if restoration_errors:
            raise RuntimeErrorWithContext(
                "UI consumer restoration failed: " + "; ".join(str(error) for error in restoration_errors)
            )
        for group in selected_groups(stack):
            try:
                ports = {} if group == "ds-demo" else self.port_map()
            except (RuntimeErrorWithContext, subprocess.TimeoutExpired, KeyError, ValueError) as exc:
                print(f"qa FAIL    {group}: {exc}", file=sys.stderr)
                failures.append(exc)
                continue
            for service in GROUPS[group]:
                try:
                    if service in stopped:
                        self.control("start", service)
                    elif service in changed and self.active(service):
                        self.control("restart", service)
                    elif not self.active(service):
                        self.control("start", service)
                    fresh = since if service in UI_SERVICES and (service in changed or service in plan.ui_changed) else None
                    try:
                        self.wait_ready(service, ports, fresh)
                    except ReadinessFailure:
                        if service in changed or service in stopped:
                            raise
                        self.control("restart", service)
                        self.wait_ready(service, ports, since if service in UI_SERVICES else None)
                except (RuntimeErrorWithContext, subprocess.TimeoutExpired, KeyError, ValueError) as exc:
                    print(f"qa FAIL    {group}: {exc}", file=sys.stderr)
                    failures.append(exc)
                    break
        if failures:
            if any(not isinstance(failure, ReadinessFailure) for failure in failures):
                raise RuntimeErrorWithContext("; ".join(str(failure) for failure in failures))
            raise ReadinessFailure("; ".join(str(failure) for failure in failures))


def selected_groups(stack: str) -> tuple[str, ...]:
    return ("app", "ds-demo") if stack == "all" else (stack,)


def selected_services(stack: str) -> tuple[str, ...]:
    return SERVICES if stack == "all" else GROUPS[stack]


def main(argv: list[str]) -> int:
    if len(argv) < 4 or argv[1] not in ("preflight", "reconcile", "status"):
        print("usage: wt-qa-runtime.py preflight|reconcile|status QA_TREE --stack app|ds-demo|all BEFORE AFTER [SINCE]", file=sys.stderr)
        return 2
    _, action, qa, *options = argv
    if len(options) < 2 or options[:1] != ["--stack"] or options[1] not in ("app", "ds-demo", "all"):
        print("expected --stack app|ds-demo|all", file=sys.stderr)
        return 2
    stack = options[1]
    remaining = options[2:]
    if (action == "status" and remaining) or (action == "preflight" and len(remaining) != 2) or (action == "reconcile" and len(remaining) not in (2, 3)):
        print("invalid arguments", file=sys.stderr)
        return 2
    runtime = Runtime(Path(qa))
    try:
        if action == "status":
            runtime.status(stack)
            return 0
        before, after, *time_options = remaining
        if action == "preflight":
            runtime.preflight(stack)
        else:
            plan, commits = runtime.changes_since_reconciliation(before, after, stack)
            since = time_options[0] if time_options else str(time.time_ns() // 1000)
            runtime.reconcile(plan, since, stack)
            for group in selected_groups(stack):
                commits[group] = after
            runtime.write_reconciled_commits(commits)
    except InstallFailure as exc:
        print(f"qa FAIL    {exc}", file=sys.stderr)
        return 3
    except ReadinessFailure as exc:
        print(f"qa FAIL    {exc}", file=sys.stderr)
        return 4
    except (RuntimeErrorWithContext, subprocess.TimeoutExpired, KeyError, ValueError) as exc:
        print(f"qa FAIL    {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
