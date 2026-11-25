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


stale = ["feat/old-a", "feat/old-b"]
stale_source = FakeSource({"slots": [
    {"slot": 2, "branch": "feat/old-a", "worktree": "/fixture/old-a", "repo": "cl-strategy", "stale": True},
    {"slot": 3, "branch": "feat/old-b", "worktree": "/fixture/old-b", "repo": "cl-system", "stale": True},
    {"slot": 4, "branch": "feat/live", "worktree": "/fixture/live", "repo": "cl-system", "stale": False},
]})
runner = FakeRunner()
shown = [{"slot": 2, "branch": "feat/old-a"}, {"slot": 3, "branch": "feat/old-b"}]
code, body = dashboard.handle_slot_stop_stale(runner, {"slots": shown}, PAGE, PORT, stale_source)
check("stale slots start one rechecked bulk action without client branch text",
      code == 202 and runner.started == [("stop-stale", ["serve", "--stop-stale",
          "--only-slot", "2", "feat/old-a", "/fixture/old-a",
          "--only-slot", "3", "feat/old-b", "/fixture/old-b"], None)])
runner = FakeRunner()
code, body = dashboard.handle_slot_stop_stale(runner, {"repo": "cl-system", "slots": shown}, PAGE, PORT, stale_source)
check("repo bulk stop uses one validated repo argument",
      code == 202 and runner.started == [("stop-stale", ["serve", "--stop-stale", "--repo", "cl-system",
          "--only-slot", "3", "feat/old-b", "/fixture/old-b"], "cl-system")])
for label, payload, headers, source, expected in [
    ("foreign origin", {"slots": shown}, {"X-QA-Dashboard": "1", "Origin": "http://evil.example"}, stale_source, 403),
    ("no stale slots", {"slots": shown}, PAGE, FakeSource({"slots": [{"repo": "cl-system", "stale": False}]}), 409),
    ("unknown repo", {"repo": "unlisted", "slots": shown}, PAGE, stale_source, 400),
    ("non-string repo", {"repo": ["cl-system"], "slots": shown}, PAGE, stale_source, 400),
    ("null repo", {"repo": None, "slots": shown}, PAGE, stale_source, 400),
    ("extra client text", {"branch": "feat/live", "slots": shown}, PAGE, stale_source, 400),
    ("missing slots", {}, PAGE, stale_source, 400),
    ("empty slots", {"slots": []}, PAGE, stale_source, 400),
    ("boolean slot", {"slots": [{"slot": True, "branch": "feat/old-a"}]}, PAGE, stale_source, 400),
    ("unsafe branch", {"slots": [{"slot": 2, "branch": "-unsafe"}]}, PAGE, stale_source, 400),
    ("no listed stale match", {"slots": [{"slot": 4, "branch": "feat/live"}]}, PAGE, stale_source, 409),
]:
    runner = FakeRunner()
    code, body = dashboard.handle_slot_stop_stale(runner, payload, headers, PORT, source)
    check(f"bulk stop refuses {label}", code == expected and not runner.started)
runner = FakeRunner(busy=True)
code, body = dashboard.handle_slot_stop_stale(runner, {"slots": shown}, PAGE, PORT, stale_source)
check("bulk stop respects the one-action limit", code == 409 and not runner.started)
runner = FakeRunner()
code, body = dashboard.handle_slot_stop_stale(runner, {"repo": "cl-system", "slots": shown + [{"slot": 4, "branch": "feat/live"}]}, PAGE, PORT, stale_source)
check("bulk stop ignores listed slots outside the current stale repo set",
      code == 202 and runner.started[0][1] == ["serve", "--stop-stale", "--repo", "cl-system",
          "--only-slot", "3", "feat/old-b", "/fixture/old-b"])


check("only status slots explicitly marked stale are selected",
      dashboard.stale_slot_branches(FakeSource({"slots": [
          {"branch": "feat/old-b", "stale": True}, {"branch": "feat/live", "stale": False},
          {"branch": "feat/old-a", "stale": True}, {"branch": "-unsafe", "stale": True},
          {"branch": "feat/unknown"},
      ]})) == stale)
check("stale selection respects the repo from current status",
      dashboard.stale_slot_branches(stale_source, "cl-system") == ["feat/old-b"])
check("bulk stop approves only complete slot identities from status",
      [(slot["slot"], slot["branch"]) for slot in dashboard.stale_slot_entries(stale_source, "cl-system")]
      == [(3, "feat/old-b")])


backend_branches = dashboard.slot_branches(FakeSource({"slots": [
    {"branch": "feat/demo", "repo": "cl-strategy", "repoBackend": True, "apps": [{"app": "ds-demo", "backend": False}]},
    {"branch": "feat/docs", "repo": "system-docs", "repoBackend": False, "apps": [{"app": "docs", "backend": False}]},
]}), backend_only=True)
check("a demo-only cl-strategy session can attach its backend; a frontend-only repo cannot",
      backend_branches == {"feat/demo"})


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
    {"slot": 4, "branch": "stopped/one", "apps": [{"app": "ri"}]},
    {"slot": "5", "branch": "odd/slot", "apps": []}]}))
check("sessions map to their slot and running apps; bad slots are left out",
      sessions == {"t3code/chart": (3, {"ri", "ds-demo"}), "stopped/one": (4, {"ri"})})
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
