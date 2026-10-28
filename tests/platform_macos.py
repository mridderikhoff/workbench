"""Isolated launchd adapter checks; no real service manager is invoked."""
import contextlib
import importlib.util
import io
import json
import os
import pathlib
import plistlib
import signal
import subprocess
import tempfile
import unittest
from unittest import mock


SOURCE = pathlib.Path(__file__).resolve().parents[1] / "bin" / "overseer_platform.py"
SPEC = importlib.util.spec_from_file_location("overseer_platform", SOURCE)
platform = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(platform)


class PlatformTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        root = pathlib.Path(self.tmp.name)
        self.units = root / "units"
        self.units.mkdir()
        self.agents = root / "agents"
        self.state = root / "state"
        self.env = mock.patch.dict(os.environ, QA_UNIT_DIR=str(self.units),
                                   OVERSEER_LAUNCH_AGENT_DIR=str(self.agents), WT_STATE_DIR=str(self.state))
        self.env.start()
        self.addCleanup(self.env.stop)

    def unit(self, name="cl-strategy-qa-backend.service", *, remain=False, envfile="", raw_file=False):
        work = pathlib.Path(self.tmp.name) / "QA tree with spaces"
        work.mkdir(exist_ok=True)
        body = ("[Service]\nType=" + ("oneshot" if remain else "simple") + "\n" +
                "WorkingDirectory=" + str(work) + "\n" +
                "ExecStart=/usr/bin/env bash -lc 'echo hello world'\n" +
                "Environment=PATH=/opt/homebrew/bin:/usr/bin\n" +
                ("EnvironmentFile=-" + (envfile if raw_file else "'" + envfile + "'") + "\n" if envfile else "") +
                ("RemainAfterExit=yes\n" if remain else "Restart=on-failure\n"))
        (self.units / name).write_text(body)
        return name

    def test_install_plist_keeps_arguments_cwd_and_environment(self):
        envfile = pathlib.Path(self.tmp.name) / "runtime env"
        envfile.write_text("CUSTOM='two words'\nPATH='/custom tools/bin:/usr/bin'\n")
        unit = self.unit(envfile=str(envfile), raw_file=True)
        data = plistlib.loads(platform.install(unit).read_bytes())
        self.assertEqual(data["Label"], "com.overseer." + unit)
        self.assertEqual(data["WorkingDirectory"], str(pathlib.Path(self.tmp.name) / "QA tree with spaces"))
        self.assertEqual(data["EnvironmentVariables"]["CUSTOM"], "two words")
        self.assertEqual(data["EnvironmentVariables"]["PATH"], "/custom tools/bin:/usr/bin")
        self.assertEqual(data["KeepAlive"], {"SuccessfulExit": False})
        self.assertEqual(data["ThrottleInterval"], 5)
        self.assertEqual(data["StandardOutPath"], data["StandardErrorPath"])
        self.assertEqual(data["ProgramArguments"][-2:], ["run-unit", unit])

    def test_timer_is_interval_agent(self):
        self.unit("cl-strategy-qa-watchdog.service")
        (self.units / "cl-strategy-qa-watchdog.timer").write_text(
            "[Timer]\nOnBootSec=2min\nOnUnitInactiveSec=2min\nUnit=cl-strategy-qa-watchdog.service\n")
        data = plistlib.loads(platform.install("cl-strategy-qa-watchdog.timer").read_bytes())
        self.assertEqual(data["StartInterval"], 120)
        self.assertFalse(data["RunAtLoad"])
        self.assertNotIn("KeepAlive", data)
        state = {"loaded": True, "state": "waiting", "pid": 0, "exit": 0}
        with mock.patch.object(platform, "_launch_state", return_value=state), \
             mock.patch.object(platform, "boot_identity", return_value=("boot", 10)):
            self.assertEqual(platform.service_snapshot("cl-strategy-qa-watchdog.timer")["ActiveState"], "active")

    def test_unknown_runner_birth_cannot_become_active(self):
        unit = self.unit()
        platform.install(unit)
        platform._atomic_json(platform.meta_path(unit), {"runner_pid": 77, "runner_birth": "100.000000",
                                                         "invocation": "abc", "boot_id": "boot"})
        state = {"loaded": True, "state": "running", "pid": 77, "exit": None}
        with mock.patch.object(platform, "_launch_state", return_value=state), \
             mock.patch.object(platform, "_birth", return_value="101.000000"), \
             mock.patch.object(platform, "boot_identity", return_value=("boot", 10)):
            snap = platform.service_snapshot(unit)
        self.assertEqual(snap["ActiveState"], "unknown")
        self.assertEqual(snap["MainPID"], "0")
        self.assertEqual(snap["InvocationID"], "")

    def test_pending_bootstrap_remains_activating_without_runner(self):
        unit = self.unit()
        platform.install(unit)
        platform._atomic_json(platform.meta_path(unit), {"request_action": "start", "request_boot": "boot",
                                                         "requested_epoch": 1000})
        state = {"loaded": True, "state": "waiting", "pid": 0, "exit": None}
        with mock.patch.object(platform, "_launch_state", return_value=state), \
             mock.patch.object(platform, "boot_identity", return_value=("boot", 10)), \
             mock.patch.object(platform.time, "time", return_value=1001):
            snap = platform.service_snapshot(unit)
        self.assertEqual(snap["ActiveState"], "activating")
        self.assertEqual(snap["Job"], "pending")

    def test_stop_clears_pending_even_when_job_unloaded(self):
        unit = self.unit()
        platform._atomic_json(platform.meta_path(unit), {"request_action": "start", "request_boot": "boot",
                                                         "requested_epoch": 1000})
        with mock.patch.object(platform, "_launch_state", return_value={"loaded": False, "state": "inactive", "pid": 0, "exit": None}):
            platform.control("stop", unit)
        self.assertNotIn("request_action", platform._metadata(unit))

    def test_multiword_launchd_states_are_honest(self):
        unit = self.unit()
        platform.install(unit)
        with mock.patch.object(platform, "_launchctl", return_value=subprocess.CompletedProcess([], 0, "state = not running\nlast exit code = 7\n", "")), \
             mock.patch.object(platform, "boot_identity", return_value=("boot", 10)):
            self.assertEqual(platform.service_snapshot(unit)["ActiveState"], "failed")
        with mock.patch.object(platform, "_launchctl", return_value=subprocess.CompletedProcess([], 0, "state = spawn scheduled\n", "")), \
             mock.patch.object(platform, "boot_identity", return_value=("boot", 10)):
            snap = platform.service_snapshot(unit)
        self.assertEqual((snap["ActiveState"], snap["Job"]), ("activating", "pending"))

    def test_oneshot_completion_and_dead_server_are_distinct(self):
        unit = self.unit("cl-strategy-qa-keycloak.service", remain=True)
        platform.install(unit)
        platform._atomic_json(platform.meta_path(unit), {"boot_id": "boot", "invocation": "abc",
                                                         "exit_code": 0, "exit_epoch": 1000})
        state = {"loaded": True, "state": "waiting", "pid": 0, "exit": 0}
        with mock.patch.object(platform, "_launch_state", return_value=state), \
             mock.patch.object(platform, "boot_identity", return_value=("boot", 10)):
            snap = platform.service_snapshot(unit)
        self.assertEqual((snap["ActiveState"], snap["SubState"]), ("active", "exited"))
        server = self.unit("cl-strategy-qa-backend.service")
        platform.install(server)
        with mock.patch.object(platform, "_launch_state", return_value=state), \
             mock.patch.object(platform, "boot_identity", return_value=("boot", 10)):
            snap = platform.service_snapshot(server)
        self.assertEqual(snap["ActiveState"], "inactive")

    def test_listener_unknown_or_foreign_is_never_owned(self):
        with mock.patch.object(platform, "listening_processes", return_value={7071: None, 2024: [42], 8000: []}), \
             mock.patch.object(platform, "unit_for_pid", return_value=None), \
             mock.patch.object(platform, "processes", return_value=[]):
            result = platform.foreign_listeners(self.tmp.name, "app", 0)
        self.assertIn("? (functions; listener owner unknown)", result)
        self.assertIn("42 (langgraph; listener)", result)

    def test_unreadable_live_own_process_fails_closed(self):
        listed = subprocess.CompletedProcess([], 0, "42 501 S\n", "")
        with mock.patch.object(platform, "is_macos", return_value=True), \
             mock.patch.object(platform, "run", return_value=listed), \
             mock.patch.object(platform, "_cwd_map", return_value={}), \
             mock.patch.object(platform, "_darwin_proc_info", return_value=None), \
             mock.patch.object(platform.os, "getuid", return_value=501), \
             mock.patch.object(platform.os, "kill", return_value=None):
            with self.assertRaisesRegex(RuntimeError, "cannot inspect live process"):
                platform.processes()

    def test_zombie_does_not_block_process_scan(self):
        listed = subprocess.CompletedProcess([], 0, "42 501 Z+\n43 501 X\n", "")
        with mock.patch.object(platform, "is_macos", return_value=True), \
             mock.patch.object(platform, "run", return_value=listed), \
             mock.patch.object(platform, "_cwd_map", return_value={}) as cwd:
            self.assertEqual(platform.processes(), [])
        cwd.assert_called_once_with([])

    def test_numeric_boot_fallback_ignores_human_date(self):
        outputs = [subprocess.CompletedProcess([], 0, "{ sec = 100, usec = 42 } Wed\n", ""),
                   subprocess.CompletedProcess([], 1, "", "unknown oid")]
        with mock.patch.object(platform, "is_macos", return_value=True), mock.patch.object(platform, "run", side_effect=outputs):
            first = platform.boot_identity()
        outputs[0] = subprocess.CompletedProcess([], 0, "{ sec = 100, usec = 42 } Thu\n", "")
        with mock.patch.object(platform, "is_macos", return_value=True), mock.patch.object(platform, "run", side_effect=outputs):
            second = platform.boot_identity()
        self.assertEqual(first, second)

    def test_termination_escalates_ignoring_child_group(self):
        child = mock.Mock(pid=77)
        child.poll.return_value = None
        child.wait.side_effect = [subprocess.TimeoutExpired(["child"], 5), -9]
        with mock.patch.object(platform.os, "killpg") as kill:
            platform._terminate_child(child, signal.SIGTERM)
        self.assertEqual(kill.call_args_list[0].args, (77, signal.SIGTERM))
        self.assertEqual(kill.call_args_list[1].args, (77, signal.SIGKILL))
        self.assertEqual(child.wait.call_args_list[0].kwargs["timeout"], 5)
        self.assertEqual(child.wait.call_args_list[1].kwargs["timeout"], 2)

    def test_restart_rebootstraps_current_plist(self):
        unit = self.unit()
        state = {"loaded": True, "state": "running", "pid": 77, "exit": None}
        result = subprocess.CompletedProcess([], 0, "", "")
        with mock.patch.object(platform, "_launch_state", return_value=state), \
             mock.patch.object(platform, "_launchctl", return_value=result) as launch, \
             mock.patch.object(platform, "boot_identity", return_value=("boot", 10)):
            platform.control("restart", unit)
        self.assertEqual(launch.call_args_list[0].args[:2], ("bootout", platform.domain() + "/" + platform.label(unit)))
        self.assertEqual(launch.call_args_list[1].args[:2], ("bootstrap", platform.domain()))

    def test_unreadable_launchd_job_refuses_mutation(self):
        unit = self.unit()
        state = {"loaded": None, "state": "unknown", "pid": 0, "exit": None}
        with mock.patch.object(platform, "_launch_state", return_value=state), \
             mock.patch.object(platform, "_launchctl") as launch:
            with self.assertRaisesRegex(RuntimeError, "cannot inspect"):
                platform.control("restart", unit)
        launch.assert_not_called()

    def test_journal_cat_uses_managed_combined_log(self):
        unit = self.unit()
        log = self.state / "logs" / (unit + ".log")
        log.parent.mkdir(parents=True)
        log.write_text("first\nsecond\nthird\n")
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            self.assertEqual(platform._journalctl(["--user", "-u", unit, "-n", "2", "-o", "cat"]), 0)
        self.assertEqual(out.getvalue(), "second\nthird\n")

    def test_no_real_launchctl_on_linux_passthrough(self):
        with mock.patch.object(platform, "is_macos", return_value=False), \
             mock.patch.object(platform.subprocess, "call", return_value=8) as call:
            self.assertEqual(platform.main(["systemctl", "--user", "is-active", "demo.service"]), 8)
        call.assert_called_once_with(["systemctl", "--user", "is-active", "demo.service"])


if __name__ == "__main__":
    unittest.main()
