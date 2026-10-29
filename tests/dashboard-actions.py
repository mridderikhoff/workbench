#!/usr/bin/env python3
"""Checks the Overseer server's backend Restart and session backend-switch actions: validation, the exact wt arguments,
and the busy refusal.
A fake runner records what would run, so nothing touches the live backend."""
import importlib.machinery
import importlib.util
import os
import sys

PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "bin", "qa-dashboard")
loader = importlib.machinery.SourceFileLoader("qa_dashboard", PATH)
spec = importlib.util.spec_from_loader("qa_dashboard", loader)
dashboard = importlib.util.module_from_spec(spec)
loader.exec_module(dashboard)


class FakeRunner:
    def __init__(self, busy=False):
        self.busy, self.started = busy, []

    def start(self, action, arguments=None, target=None):
        if self.busy:
            return False
        self.started.append((action, arguments, target))
        return True

    def snapshot(self):
        return {"state": "running"} if self.busy or self.started else None


PORT = 5100
PAGE = {"X-QA-Dashboard": "1", "Origin": f"http://localhost:{PORT}"}
SERVICES = {"azurite", "keycloak", "functions", "langgraph", "backend"}
failures = 0


def check(name, condition):
    global failures
    print(("ok   " if condition else "FAIL ") + name)
    failures += 0 if condition else 1


runner = FakeRunner()
code, body = dashboard.handle_service_restart(runner, {"service": "functions"}, PAGE, PORT, SERVICES)
check("a listed service starts `wt backend restart <service>` with the service as target",
      code == 202 and runner.started == [("restart", ["backend", "restart", "functions"], "functions")])

for label, payload in [("an unknown service", {"service": "postgres"}), ("shell text", {"service": "functions; rm -rf ~"}),
                       ("a non-string", {"service": ["functions"]}), ("no service", {}), ("a non-object body", None)]:
    runner = FakeRunner()
    code, body = dashboard.handle_service_restart(runner, payload, PAGE, PORT, SERVICES)
    check(f"{label} is refused with 400 and runs nothing", code == 400 and not runner.started)

for label, headers in [("no page header", {"Origin": f"http://localhost:{PORT}"}),
                       ("a foreign origin", {"X-QA-Dashboard": "1", "Origin": "http://evil.example"})]:
    runner = FakeRunner()
    code, body = dashboard.handle_service_restart(runner, {"service": "functions"}, headers, PORT, SERVICES)
    check(f"{label} is refused with 403 and runs nothing", code == 403 and not runner.started)

runner = FakeRunner(busy=True)
code, body = dashboard.handle_service_restart(runner, {"service": "functions"}, PAGE, PORT, SERVICES)
check("a second action while one runs gets 409 with the running action", code == 409 and body.get("actions"))

BRANCHES = {"mridderikhoff/STR-1", "t3code/chart"}
runner = FakeRunner()
code, body = dashboard.handle_slot_backend(runner, {"branch": "t3code/chart"}, PAGE, PORT, BRANCHES)
check("a session branch starts `wt qa <branch>` with the branch as target",
      code == 202 and runner.started == [("attach", ["qa", "t3code/chart"], "t3code/chart")])

for label, payload in [("a branch with no session", {"branch": "develop"}), ("shell text", {"branch": "t3code/chart; rm -rf ~"}),
                       ("a non-string", {"branch": ["t3code/chart"]}), ("no branch", {}), ("a non-object body", None)]:
    runner = FakeRunner()
    code, body = dashboard.handle_slot_backend(runner, payload, PAGE, PORT, BRANCHES)
    check(f"switching to {label} is refused with 400 and runs nothing", code == 400 and not runner.started)

runner = FakeRunner()
code, body = dashboard.handle_slot_backend(runner, {"branch": "t3code/chart"}, {"X-QA-Dashboard": "1", "Origin": "http://evil.example"}, PORT, BRANCHES)
check("a backend switch from a foreign origin is refused with 403", code == 403 and not runner.started)

runner = FakeRunner(busy=True)
code, body = dashboard.handle_slot_backend(runner, {"branch": "t3code/chart"}, PAGE, PORT, BRANCHES)
check("a backend switch while another action runs gets 409", code == 409 and not runner.started)


class FakeSource:
    def __init__(self, status):
        self.status = status

    def get(self):
        if isinstance(self.status, Exception):
            raise self.status
        return self.status


check("known services come from the current backend status",
      dashboard.backend_services(FakeSource({"backend": {"services": {"functions": {}, "backend": {}}}})) == {"functions", "backend"})
check("an unreadable status confirms no service", dashboard.backend_services(FakeSource(RuntimeError("down"))) == set())

print("all passed" if not failures else f"{failures} failed")
sys.exit(1 if failures else 0)
