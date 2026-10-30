#!/usr/bin/env python3
"""Checks the Overseer server's backend Restart, session backend-switch and app start actions: validation, the exact wt
arguments, and the busy refusal.
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

    def start(self, action, arguments=None, target=None, app=None):
        if self.busy:
            return False
        self.started.append((action, arguments, target) if app is None else (action, arguments, target, app))
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


SESSIONS = {"t3code/chart": (3, {"ri"}), "feat/docs": (7, {"ds-demo"})}
ALL_APPS = ("ri", "ds-demo", "strategy")
for app in ("ds-demo", "strategy"):
    runner = FakeRunner()
    code, body = dashboard.handle_slot_start(runner, {"branch": "t3code/chart", "app": app}, PAGE, PORT, SESSIONS, ALL_APPS)
    check(f"starting {app} for a session runs `wt serve <branch> {app}` with the branch and app as target",
          code == 202 and runner.started == [("start", ["serve", "t3code/chart", app], "t3code/chart", app)])

saved_apps = os.environ.pop("WT_APPS", None)
check("the managed apps default to RI then ds-demo", dashboard.managed_apps() == ("ri", "ds-demo"))
runner = FakeRunner()
code, body = dashboard.handle_slot_start(runner, {"branch": "t3code/chart", "app": "strategy"}, PAGE, PORT, SESSIONS)
check("Strategy is refused by default because WT_APPS leaves it out", code == 400 and not runner.started)
os.environ["WT_APPS"] = "strategy ds-demo ri"
runner = FakeRunner()
code, body = dashboard.handle_slot_start(runner, {"branch": "t3code/chart", "app": "strategy"}, PAGE, PORT, SESSIONS)
check("Strategy starts when WT_APPS includes it", code == 202 and runner.started[0][1] == ["serve", "t3code/chart", "strategy"])
check("WT_APPS sets the display order", dashboard.managed_apps() == ("strategy", "ds-demo", "ri"))
check("WT_APPS keeps only apps wt serve accepts, each once", dashboard.managed_apps("ri backend ri ds-demo;rm") == ("ri",))
check("the page is rendered with the managed apps in order", '["strategy", "ds-demo", "ri"]' in dashboard.render_html({}))
if saved_apps is None:
    os.environ.pop("WT_APPS", None)
else:
    os.environ["WT_APPS"] = saved_apps

for label, payload, expected in [
        ("an unknown app", {"branch": "t3code/chart", "app": "backend"}, 400),
        ("shell text as the app", {"branch": "t3code/chart", "app": "ri; rm -rf ~"}, 400),
        ("an option as the app", {"branch": "t3code/chart", "app": "--stop"}, 400),
        ("a non-string app", {"branch": "t3code/chart", "app": ["ri"]}, 400),
        ("no app", {"branch": "t3code/chart"}, 400),
        ("an unknown branch", {"branch": "develop", "app": "ri"}, 400),
        ("shell text as the branch", {"branch": "t3code/chart; rm -rf ~", "app": "ri"}, 400),
        ("no branch", {"app": "ri"}, 400),
        ("a non-object body", None, 400),
        ("an app the session already runs", {"branch": "t3code/chart", "app": "ri"}, 409),
        ("RI on a ds-demo-only slot", {"branch": "feat/docs", "app": "ri"}, 400)]:
    runner = FakeRunner()
    code, body = dashboard.handle_slot_start(runner, payload, PAGE, PORT, SESSIONS, ALL_APPS)
    check(f"starting {label} is refused with {expected} and runs nothing", code == expected and not runner.started)

runner = FakeRunner()
code, body = dashboard.handle_slot_start(runner, {"branch": "t3code/chart", "app": "ds-demo"}, {"X-QA-Dashboard": "1", "Origin": "http://evil.example"}, PORT, SESSIONS, ALL_APPS)
check("an app start from a foreign origin is refused with 403", code == 403 and not runner.started)

runner = FakeRunner(busy=True)
code, body = dashboard.handle_slot_start(runner, {"branch": "t3code/chart", "app": "ds-demo"}, PAGE, PORT, SESSIONS)
check("an app start while another action runs gets 409 with the running action", code == 409 and body.get("actions"))

sessions = dashboard.slot_sessions(FakeSource({"slots": [
    {"slot": 3, "branch": "t3code/chart", "apps": [{"app": "ri"}, {"app": "ds-demo"}]},
    {"slot": 4, "branch": "saved/one", "apps": [{"app": "ri"}], "recovery": {"fingerprint": "x"}},
    {"slot": "5", "branch": "odd/slot", "apps": []}]}))
check("live sessions map to their slot and running apps; saved sessions and bad slots are left out",
      sessions == {"t3code/chart": (3, {"ri", "ds-demo"})})
real = dashboard.ActionRunner(wt="/bin/true")
real.start("start", ["serve", "t3code/chart", "ri"], target="t3code/chart", app="ri")
snapshot = real.snapshot()
check("a running start reports its app and target to the page, never its arguments",
      snapshot["app"] == "ri" and snapshot["target"] == "t3code/chart" and "arguments" not in snapshot)
check("an unreadable status confirms no session", dashboard.slot_sessions(FakeSource(RuntimeError("down"))) == {})

check("known services come from the current backend status",
      dashboard.backend_services(FakeSource({"backend": {"services": {"functions": {}, "backend": {}}}})) == {"functions", "backend"})
check("an unreadable status confirms no service", dashboard.backend_services(FakeSource(RuntimeError("down"))) == set())

print("all passed" if not failures else f"{failures} failed")
sys.exit(1 if failures else 0)
