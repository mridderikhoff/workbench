#!/usr/bin/env python3
"""Small native macOS runtime for Overseer's existing shell command surface.

No launchd mutation happens on import.  The command runner is injectable for
fixture tests; failures to establish process ownership are deliberately unknown.
"""
from __future__ import annotations

import ctypes
import ctypes.util
import datetime as dt
import functools
import hashlib
import json
import os
import pathlib
import plistlib
import re
import shlex
import shutil
import signal
import subprocess
import sys
import time
import uuid
from typing import Any


def is_macos() -> bool:
    return sys.platform == "darwin"


def _check_deadline() -> float | None:
    deadline = os.environ.get("WT_ENSURE_DEADLINE", "")
    if deadline.isdigit():
        remaining = int(deadline) - time.time()
        if remaining <= 0:
            raise RuntimeError("runtime inspection deadline expired")
        return remaining
    return None


def run(args: list[str], *, timeout: float = 5, **kwargs: Any) -> subprocess.CompletedProcess:
    remaining = _check_deadline()
    if remaining is not None:
        timeout = min(timeout, remaining)
    return subprocess.run(args, timeout=timeout, capture_output=True, text=True, **kwargs)


def state_dir() -> pathlib.Path:
    return pathlib.Path(os.environ.get("WT_STATE_DIR", pathlib.Path.home() / ".cl-strategy-local"))


def unit_dir() -> pathlib.Path:
    default = pathlib.Path.home() / (".config/overseer/units" if is_macos() else ".config/systemd/user")
    return pathlib.Path(os.environ.get("QA_UNIT_DIR", default))


def agent_dir() -> pathlib.Path:
    return pathlib.Path(os.environ.get("OVERSEER_LAUNCH_AGENT_DIR", state_dir() / "launchd/plists"))


def enabled_dir() -> pathlib.Path:
    return pathlib.Path(os.environ.get("OVERSEER_ENABLED_AGENT_DIR", pathlib.Path.home() / "Library/LaunchAgents"))


def domain() -> str:
    return f"gui/{os.getuid()}"


def label(unit: str) -> str:
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.@-]{0,180}\.(service|timer)", unit):
        raise ValueError(f"invalid managed unit: {unit}")
    if not unit.startswith(("cl-strategy-qa-", "cl-strategy-serve-")) and not unit.startswith(os.environ.get("QA_UNIT_PREFIX", "cl-strategy-qa-")):
        raise ValueError(f"unmanaged unit: {unit}")
    return "com.overseer." + unit


def plist_path(unit: str) -> pathlib.Path:
    return agent_dir() / (label(unit) + ".plist")


def enabled_path(unit: str) -> pathlib.Path:
    return enabled_dir() / (label(unit) + ".plist")


def meta_path(unit: str) -> pathlib.Path:
    return state_dir() / "launchd" / (unit + ".json")


def _atomic_json(path: pathlib.Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(path.name + f".{os.getpid()}.tmp")
    temp.write_text(json.dumps(data), encoding="utf-8")
    os.replace(temp, path)


def _metadata(unit: str) -> dict:
    try:
        return json.loads(meta_path(unit).read_text(encoding="utf-8"))
    except (OSError, ValueError, TypeError):
        return {}


def _sections(path: pathlib.Path) -> dict[str, list[str]]:
    data: dict[str, list[str]] = {}
    section = ""
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith(("#", ";")):
            continue
        if line.startswith("[") and line.endswith("]"):
            section = line[1:-1]
            continue
        data.setdefault(section, []).append(line)
    return data


def _values(lines: list[str], key: str) -> list[str]:
    return [line.split("=", 1)[1] for line in lines if line.startswith(key + "=")]


def _definition(unit: str) -> dict:
    path = unit_dir() / unit
    sections = _sections(path)
    for dropin in sorted((unit_dir() / (unit + ".d")).glob("*.conf")):
        added = _sections(dropin)
        for section, lines in added.items():
            for line in lines:
                key = line.split("=", 1)[0]
                if line.endswith("="):
                    sections[section] = [x for x in sections.get(section, []) if not x.startswith(key + "=")]
                else:
                    sections.setdefault(section, []).append(line)
    service = sections.get("Service", [])
    install = sections.get("Install", [])
    timer = sections.get("Timer", [])
    def one(key: str, default: str = "") -> str:
        values = _values(service, key)
        return values[-1] if values else default
    env: dict[str, str] = {}
    for spec in _values(service, "Environment"):
        for item in shlex.split(spec):
            if "=" in item:
                key, value = item.split("=", 1)
                env[key] = value
    # systemd applies EnvironmentFile after inline Environment directives,
    # regardless of their text order. A colleague's runtime.env must win.
    for file_spec in _values(service, "EnvironmentFile"):
        optional = file_spec.startswith("-")
        raw_path = file_spec[1:] if optional else file_spec
        # systemd treats EnvironmentFile's complete value as the path. Older
        # generated definitions quoted it, so accept that form as well.
        file = pathlib.Path(shlex.split(raw_path)[0] if raw_path.startswith(('"', "'")) else raw_path)
        if not file.exists() and optional:
            continue
        for line in file.read_text(encoding="utf-8").splitlines():
            if line.strip() and not line.lstrip().startswith("#"):
                parsed = shlex.split(line, comments=True)
                if parsed and "=" in parsed[0]:
                    key, value = parsed[0].split("=", 1)
                    env[key] = value
    command = one("ExecStart").lstrip("-")
    return {"path": str(path), "type": one("Type", "simple"), "cwd": one("WorkingDirectory"),
            "argv": shlex.split(command) if command else [], "env": env,
            "restart": one("Restart"), "wanted_by": _values(install, "WantedBy"),
            "wants": _values(sections.get("Unit", []), "Wants"),
            "interval": 120 if unit.endswith(".timer") else 0,
            "remain": one("RemainAfterExit") == "yes", "post": _values(service, "ExecStartPost")}


def _service_for_timer(unit: str) -> str:
    if not unit.endswith(".timer"):
        return unit
    vals = _values(_sections(unit_dir() / unit).get("Timer", []), "Unit")
    return vals[-1] if vals else unit[:-6] + ".service"


def _timer_interval(unit: str) -> int:
    """Map the generated watchdog's monotonic timer to launchd StartInterval."""
    timer = _sections(unit_dir() / unit).get("Timer", [])
    values = _values(timer, "OnUnitInactiveSec") or _values(timer, "OnUnitActiveSec") or _values(timer, "OnBootSec")
    if not values:
        raise ValueError(f"timer has no interval: {unit}")
    value = values[-1].strip().lower()
    match = re.fullmatch(r"(\d+)\s*(s|sec|second|seconds|m|min|minute|minutes|h|hour|hours)?", value)
    if not match:
        raise ValueError(f"unsupported timer interval: {value}")
    multiplier = {None: 1, "s": 1, "sec": 1, "second": 1, "seconds": 1,
                  "m": 60, "min": 60, "minute": 60, "minutes": 60,
                  "h": 3600, "hour": 3600, "hours": 3600}[match.group(2)]
    interval = int(match.group(1)) * multiplier
    if interval <= 0:
        raise ValueError(f"invalid timer interval: {value}")
    return interval


def install(unit: str) -> pathlib.Path:
    label(unit)
    definition = _definition(_service_for_timer(unit))
    if not definition["argv"]:
        raise ValueError(f"missing ExecStart for {unit}")
    if definition["cwd"] and not pathlib.Path(definition["cwd"]).is_dir():
        raise ValueError(f"WorkingDirectory missing: {definition['cwd']}")
    logs = state_dir() / "logs"
    logs.mkdir(parents=True, exist_ok=True)
    args = [sys.executable, str(pathlib.Path(__file__).resolve()), "run-unit", unit]
    data: dict[str, Any] = {"Label": label(unit), "ProgramArguments": args,
                            "StandardOutPath": str(logs / (unit + ".log")),
                            "StandardErrorPath": str(logs / (unit + ".log")),
                            "RunAtLoad": not unit.endswith(".timer"),
                            "WorkingDirectory": definition["cwd"] or str(pathlib.Path.home()),
                            "EnvironmentVariables": definition["env"]}
    if unit.endswith(".timer"):
        data["StartInterval"] = _timer_interval(unit)
    elif definition["restart"] in ("on-failure", "always"):
        data["KeepAlive"] = {"SuccessfulExit": definition["restart"] == "always"}
        data["ThrottleInterval"] = 5
    path = plist_path(unit)
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(path.name + f".{os.getpid()}.tmp")
    temp.write_bytes(plistlib.dumps(data))
    os.replace(temp, path)
    persistent = enabled_path(unit)
    if persistent.exists():
        _copy_plist(path, persistent)
    return path


def _copy_plist(source: pathlib.Path, destination: pathlib.Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    temp = destination.with_name(destination.name + f".{os.getpid()}.tmp")
    shutil.copyfile(source, temp)
    os.replace(temp, destination)


def _launchctl(*args: str, timeout: float = 10) -> subprocess.CompletedProcess:
    return run(["launchctl", *args], timeout=timeout)


def _launch_state(unit: str) -> dict:
    result = _launchctl("print", domain() + "/" + label(unit))
    if result.returncode:
        message = result.stdout + result.stderr
        absent = bool(re.search(r"could not find service|service.*not found|unknown service", message, re.I))
        return {"loaded": False if absent else None, "state": "inactive" if absent else "unknown",
                "pid": 0, "exit": None, "raw": message}
    body = result.stdout
    match = re.search(r"(?m)^\s*state\s*=\s*([^\r\n]+)", body)
    pid = re.search(r"(?m)^\s*pid\s*=\s*(\d+)", body)
    last = re.search(r"(?m)^\s*last exit code\s*=\s*(-?\d+)", body)
    return {"loaded": True, "state": match.group(1).strip().lower() if match else "unknown",
            "pid": int(pid.group(1)) if pid else 0,
            "exit": int(last.group(1)) if last else None, "raw": body}


def _birth(pid: int) -> str | None:
    info = process_info(pid)
    return info["start_time"] if info else None


def _iso(epoch: float | int | None) -> str:
    return "@" + str(int(epoch)) if epoch else "@0"


def service_snapshot(unit: str) -> dict[str, str]:
    label(unit)
    source = unit_dir() / unit
    plist = plist_path(unit)
    if not source.exists() and not plist.exists():
        return {"LoadState": "not-found", "ActiveState": "inactive"}
    state = _launch_state(unit)
    meta = _metadata(unit)
    try:
        definition = _definition(_service_for_timer(unit))
    except (OSError, ValueError):
        definition = {"cwd": "", "type": "simple", "argv": [], "remain": False}
    pid = state["pid"]
    trusted = bool(pid and pid == meta.get("runner_pid") and _birth(pid) == meta.get("runner_birth") and meta.get("invocation"))
    # launchctl's PID is the runner.  A stale metadata file is never evidence.
    running = state["loaded"] and state["state"] == "running" and trusted
    current_boot = boot_identity()[0]
    same_boot = bool(current_boot) and meta.get("boot_id") == current_boot
    completed_oneshot = bool(definition.get("remain"))
    interval_timer = unit.endswith(".timer")
    pending = (bool(state["loaded"]) and bool(current_boot) and meta.get("request_boot") == current_boot and
               time.time() - float(meta.get("requested_epoch", 0)) < 180 and
               not trusted and meta.get("request_action") in ("start", "restart"))
    if state["loaded"] is None:
        active = "unknown"
    elif state["loaded"] and state["state"] == "running" and not trusted:
        active = "unknown"
    elif running:
        active = "active"
    elif pending or state["state"] in ("spawn scheduled", "spawned", "activating"):
        active = "activating"
    elif not state["loaded"]:
        active = "inactive"
    elif interval_timer:
        active = "active"
    elif completed_oneshot and same_boot and not pid and meta.get("exit_code") == 0 and state["exit"] == 0:
        active = "active"
    elif state["state"] in ("waiting", "not running") and state["exit"] not in (None, 0):
        active = "failed"
    elif state["state"] not in ("waiting", "not running", "inactive"):
        active = "unknown"
    else:
        active = "inactive"
    started = meta.get("started_epoch") if trusted or (state["loaded"] and not pid and meta.get("exit_epoch")) else None
    exited = meta.get("exit_epoch") if state["loaded"] and not pid else None
    # Monotonic values only belong to the same boot; boot ID is recorded by runner.
    mono = str(meta.get("started_monotonic_us", 0)) if same_boot and started else "0"
    inactive = str(meta.get("exited_monotonic_us", 0)) if same_boot and exited else "0"
    result = "success" if state["exit"] in (None, 0) else "exit-code"
    return {"LoadState": "loaded" if source.exists() else "not-found", "ActiveState": active,
            "SubState": "running" if running else "waiting" if interval_timer and active == "active" else "exited" if completed_oneshot and active == "active" else "dead",
            "UnitFileState": "enabled" if enabled_path(unit).exists() else "disabled", "Type": definition["type"],
            "Result": result, "MainPID": str(pid if trusted else 0), "WorkingDirectory": definition["cwd"],
            "Job": "pending" if active == "activating" else "", "InvocationID": meta.get("invocation", "") if trusted else "",
            "ExecMainStartTimestampMonotonic": mono, "InactiveEnterTimestampMonotonic": inactive,
            "ExecMainStartTimestamp": _iso(started), "ExecMainExitTimestamp": _iso(exited),
            "ActiveEnterTimestamp": _iso(started if running else None),
            "InactiveEnterTimestamp": _iso(exited), "NRestarts": str(meta.get("restart_count", 0)),
            "ExecMainCode": "1" if state["exit"] is not None else "0",
            "ExecMainStatus": str(state["exit"] or 0), "ExecStart": " ".join(definition["argv"]),
            "FragmentPath": str(source) if source.exists() else ""}


def _units_for_target(unit: str) -> list[str]:
    result: list[str] = []
    for want in _values(_sections(unit_dir() / unit).get("Unit", []), "Wants"):
        for item in want.split():
            if item.endswith(".target"):
                result.extend(_units_for_target(item))
            else:
                result.append(item)
    return result


def _clear_request(unit: str) -> None:
    previous = _metadata(unit)
    if "request_action" in previous:
        previous.pop("request_action", None)
        previous.pop("request_boot", None)
        previous.pop("requested_epoch", None)
        _atomic_json(meta_path(unit), previous)


def control(action: str, unit: str) -> None:
    if unit.endswith(".target"):
        for member in _units_for_target(unit):
            control(action, member)
        return
    label(unit)
    if action == "daemon-reload":
        install(unit)
        return
    if action == "reset-failed":
        return
    if action in ("enable", "start", "restart"):
        path = install(unit)
        if action == "enable":
            _copy_plist(path, enabled_path(unit))
            path = enabled_path(unit)
        current = _launch_state(unit)
        if current["loaded"] is None:
            raise RuntimeError("cannot inspect launchd job before mutation")
        if action == "enable" and current["loaded"]:
            return
        if action == "start" and current["loaded"] and current["state"] == "running":
            return
        boot = boot_identity()[0]
        if not boot:
            raise RuntimeError("cannot read boot identity before launchd mutation")
        previous = _metadata(unit)
        previous.update(request_action=action, requested_epoch=time.time(), request_boot=boot)
        _atomic_json(meta_path(unit), previous)
        # A loaded job keeps its old plist after a file rewrite. Rebootstrap is
        # required to pick up changes in cwd, argv, environment and logging.
        if current["loaded"]:
            stopped = _launchctl("bootout", domain() + "/" + label(unit), timeout=20)
            if stopped.returncode:
                raise RuntimeError((stopped.stderr or stopped.stdout).strip() or "launchctl bootout failed")
        result = _launchctl("bootstrap", domain(), str(path), timeout=20)
    elif action in ("stop", "disable"):
        current = _launch_state(unit)
        if current["loaded"] is None:
            raise RuntimeError("cannot inspect launchd job before mutation")
        if not current["loaded"]:
            _clear_request(unit)
            if action == "disable":
                enabled_path(unit).unlink(missing_ok=True)
            return
        result = _launchctl("bootout", domain() + "/" + label(unit), timeout=20)
    else:
        raise ValueError(action)
    if result.returncode:
        if action in ("enable", "start", "restart"):
            previous = _metadata(unit)
            previous.pop("request_action", None)
            _atomic_json(meta_path(unit), previous)
        raise RuntimeError((result.stderr or result.stdout).strip() or f"launchctl {action} failed")
    if action == "disable":
        enabled_path(unit).unlink(missing_ok=True)
    if action in ("stop", "disable"):
        _clear_request(unit)


def _runner(unit: str) -> int:
    spec = _definition(_service_for_timer(unit))
    env = os.environ.copy()
    env.update(spec["env"])
    cwd = spec["cwd"] or str(pathlib.Path.home())
    previous = _metadata(unit)
    invocation = uuid.uuid4().hex
    boot = boot_identity()[0]
    if not boot:
        raise RuntimeError("cannot read boot identity for managed runner")
    blocked = {signal.SIGTERM, signal.SIGINT}
    old_mask = signal.pthread_sigmask(signal.SIG_BLOCK, blocked)
    process = None
    def terminate(signum: int, _frame: Any) -> None:
        if process is not None:
            _terminate_child(process, signum)
    try:
        process = subprocess.Popen(spec["argv"], cwd=cwd, env=env, start_new_session=True)
        runner_pid = os.getpid()
        runner_birth = _birth(runner_pid)
        if not runner_birth:
            raise RuntimeError("cannot verify runner birth")
        data = {"invocation": invocation, "runner_pid": runner_pid, "runner_birth": runner_birth,
                "child_pid": process.pid, "child_birth": _birth(process.pid), "boot_id": boot,
                "started_epoch": time.time(), "started_monotonic_us": time.monotonic_ns() // 1000,
                "restart_count": int(previous.get("restart_count", 0)) + 1}
        _atomic_json(meta_path(unit), data)
        signal.signal(signal.SIGTERM, terminate)
        signal.signal(signal.SIGINT, terminate)
    except BaseException:
        if process is not None and process.poll() is None:
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            process.wait(timeout=2)
        raise
    finally:
        signal.pthread_sigmask(signal.SIG_SETMASK, old_mask)
    for post in spec["post"]:
        try:
            subprocess.run(shlex.split(post.lstrip("-")), cwd=cwd, env=env, timeout=120, check=True)
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
            if not post.startswith("-"):
                terminate(signal.SIGTERM, None)
                raise
    code = process.wait()
    data.update(exit_epoch=time.time(), exited_monotonic_us=time.monotonic_ns() // 1000, exit_code=code)
    _atomic_json(meta_path(unit), data)
    return code


def _terminate_child(process: subprocess.Popen, signum: int) -> None:
    # The direct child remains unreaped while signaling, so its PID/PGID
    # cannot be reused. Never signal a group after the leader was reaped.
    if process.poll() is not None:
        return
    try:
        os.killpg(process.pid, signum)
    except ProcessLookupError:
        return
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        if process.poll() is None:
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            process.wait(timeout=2)


def boot_identity() -> tuple[str, int]:
    if not is_macos():
        try:
            ident = pathlib.Path("/proc/sys/kernel/random/boot_id").read_text().strip()
            epoch = int(next(line.split()[1] for line in pathlib.Path("/proc/stat").read_text().splitlines() if line.startswith("btime ")))
            return ident, epoch
        except (OSError, ValueError, StopIteration):
            return "", 0
    result = run(["sysctl", "-n", "kern.boottime"], timeout=2)
    match = re.search(r"sec\s*=\s*(\d+).*usec\s*=\s*(\d+)", result.stdout)
    if result.returncode or not match:
        return "", 0
    epoch = int(match.group(1))
    session = run(["sysctl", "-n", "kern.bootsessionuuid"], timeout=2)
    uuid_text = session.stdout.strip().lower()
    if session.returncode == 0 and re.fullmatch(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", uuid_text):
        return uuid_text, epoch
    numeric = f"{match.group(1)}:{match.group(2)}"
    return hashlib.sha256(numeric.encode()).hexdigest()[:32], epoch


def _cwd_map(pids: list[int]) -> dict[int, str]:
    if not pids:
        return {}
    result: dict[int, str] = {}
    # lsof accepts comma-separated PIDs. A scan uses one bounded call rather
    # than starting a child process for each process on the machine.
    for start in range(0, len(pids), 500):
        batch = pids[start:start + 500]
        rows = run(["lsof", "-a", "-d", "cwd", "-Fn", "-p", ",".join(map(str, batch))], timeout=5)
        if rows.returncode not in (0, 1):
            raise RuntimeError("cannot inspect process working directories")
        current = None
        for line in rows.stdout.splitlines():
            if line.startswith("p") and line[1:].isdigit():
                current = int(line[1:])
            elif line.startswith("n") and current is not None:
                result[current] = line[1:]
    return result


@functools.lru_cache(maxsize=1)
def _darwin_libs() -> tuple[Any, Any]:
    return (ctypes.CDLL(ctypes.util.find_library("proc") or "/usr/lib/libproc.dylib"),
            ctypes.CDLL(ctypes.util.find_library("c") or "/usr/lib/libSystem.B.dylib"))


def _darwin_proc_info(pid: int, cwd_map: dict[int, str] | None = None) -> dict | None:
    # PROC_PIDTBSDINFO gives birth/parent/UID without parsing ps output.
    class Timeval(ctypes.Structure):
        _fields_ = [("sec", ctypes.c_int64), ("usec", ctypes.c_int64)]
    class BSDInfo(ctypes.Structure):
        _fields_ = [("flags", ctypes.c_uint32), ("status", ctypes.c_uint32), ("xstatus", ctypes.c_uint32),
                    ("pid", ctypes.c_uint32), ("ppid", ctypes.c_uint32), ("uid", ctypes.c_uint32),
                    ("gid", ctypes.c_uint32), ("ruid", ctypes.c_uint32), ("rgid", ctypes.c_uint32),
                    ("svuid", ctypes.c_uint32), ("svgid", ctypes.c_uint32), ("rfu_1", ctypes.c_uint32),
                    ("comm", ctypes.c_char * 16), ("name", ctypes.c_char * 32), ("nfiles", ctypes.c_uint32),
                    ("pgid", ctypes.c_uint32), ("pjobc", ctypes.c_uint32), ("e_tdev", ctypes.c_uint32),
                    ("e_tpgid", ctypes.c_uint32), ("nice", ctypes.c_int32), ("start", Timeval)]
    lib, libc = _darwin_libs()
    info = BSDInfo()
    size = lib.proc_pidinfo(pid, 3, 0, ctypes.byref(info), ctypes.sizeof(info))
    if size != ctypes.sizeof(info) or info.pid != pid:
        return None
    # KERN_PROCARGS2: exact NUL-separated argv. A denied sysctl is unknown.
    mib = (ctypes.c_int * 3)(1, 49, pid)
    length = ctypes.c_size_t(0)
    if libc.sysctl(mib, 3, None, ctypes.byref(length), None, 0) != 0 or not length.value:
        return None
    buffer = ctypes.create_string_buffer(length.value)
    if libc.sysctl(mib, 3, buffer, ctypes.byref(length), None, 0) != 0:
        return None
    raw = buffer.raw[:length.value]
    argc = int.from_bytes(raw[:4], sys.byteorder, signed=True)
    if argc <= 0 or argc > 4096:
        return None
    rest = raw[4:]
    exe, _, rest = rest.partition(b"\0")
    rest = rest.lstrip(b"\0")
    argv = [part.decode(errors="replace") for part in rest.split(b"\0")[:argc]]
    if len(argv) != argc or not argv[0]:
        return None
    cwd = (cwd_map if cwd_map is not None else _cwd_map([pid])).get(pid)
    return {"pid": pid, "ppid": int(info.ppid), "uid": int(info.uid), "argv": argv,
            "cwd": cwd, "start_time": f"{info.start.sec}.{info.start.usec:06d}", "executable": exe.decode(errors="replace")}


def process_info(pid: int) -> dict | None:
    if pid <= 0:
        return None
    if is_macos():
        try:
            return _darwin_proc_info(pid)
        except (OSError, ValueError):
            return None
    try:
        root = pathlib.Path("/proc") / str(pid)
        status = root.joinpath("status").read_text()
        ppid = int(re.search(r"(?m)^PPid:\s*(\d+)", status).group(1))
        uid = int(re.search(r"(?m)^Uid:\s*(\d+)", status).group(1))
        argv = [x.decode(errors="replace") for x in root.joinpath("cmdline").read_bytes().split(b"\0") if x]
        stat = root.joinpath("stat").read_text()
        start = stat.rsplit(") ", 1)[1].split()[19]
        return {"pid": pid, "ppid": ppid, "uid": uid, "argv": argv,
                "cwd": os.path.realpath(root / "cwd"), "start_time": start}
    except (OSError, AttributeError, ValueError, IndexError):
        return None


def processes() -> list[dict]:
    if is_macos():
        result = run(["ps", "-axo", "pid=,uid=,stat="], timeout=5)
        if result.returncode:
            raise RuntimeError("cannot list processes")
        rows = [line.split() for line in result.stdout.splitlines()]
        if any(len(row) != 3 or not all(value.isdigit() for value in row[:2]) for row in rows):
            raise RuntimeError("cannot parse process list")
        live_rows = [(int(pid), int(uid)) for pid, uid, stat in rows if not stat.startswith(("Z", "X"))]
        cwd_by_pid = _cwd_map([pid for pid, _ in live_rows])
        found: list[dict] = []
        for pid, uid in live_rows:
            _check_deadline()
            info = _darwin_proc_info(pid, cwd_by_pid)
            if info:
                if uid == os.getuid() and not info.get("cwd"):
                    try:
                        os.kill(pid, 0)
                    except ProcessLookupError:
                        continue
                    raise RuntimeError(f"cannot inspect working directory of live process {pid}")
                found.append(info)
            elif uid == os.getuid():
                try:
                    os.kill(pid, 0)
                except ProcessLookupError:
                    continue
                except PermissionError:
                    pass
                raise RuntimeError(f"cannot inspect live process {pid}")
        return found
    else:
        pids = [int(x.name) for x in pathlib.Path("/proc").iterdir() if x.name.isdigit()]
    return [info for pid in pids if (info := process_info(pid))]


def listening_processes(ports: list[int] | tuple[int, ...]) -> dict[int, list[int] | None]:
    answer: dict[int, list[int] | None] = {}
    for port in ports:
        if not 1 <= int(port) <= 65535:
            answer[int(port)] = None
            continue
        result = run(["lsof", "-nP", "-t", "-iTCP:" + str(port), "-sTCP:LISTEN"], timeout=3)
        if result.returncode == 1 and not result.stdout.strip() and not result.stderr.strip():
            answer[int(port)] = []
        elif result.returncode == 0:
            found = [int(x) for x in result.stdout.split() if x.isdigit()]
            answer[int(port)] = sorted(set(found)) if found else None
        else:
            answer[int(port)] = None
    return answer


def unit_for_pid(pid: int, _cache: dict | None = None, _proc: dict[int, dict] | None = None) -> str | None:
    cache = _cache if _cache is not None else {}
    proc = _proc if _proc is not None else {}
    target = proc.get(pid) or process_info(pid)
    if not target:
        return None
    for source in unit_dir().glob("cl-strategy-*.service"):
        _check_deadline()
        unit = source.name
        if unit not in cache:
            state = _launch_state(unit)
            meta = _metadata(unit)
            root = state["pid"]
            birth = (proc.get(root) or process_info(root)) if root else None
            cache[unit] = (root, meta, birth)
        root, meta, birth = cache[unit]
        if not root or root != meta.get("runner_pid") or not birth or birth["start_time"] != meta.get("runner_birth"):
            continue
        current = target
        seen: set[int] = set()
        while current and current["pid"] not in seen:
            if current["pid"] == root:
                return unit
            if current["uid"] != target["uid"] or current["start_time"] < meta["runner_birth"]:
                break
            seen.add(current["pid"])
            current = proc.get(current["ppid"]) or process_info(current["ppid"])
    return None


def foreign_listeners(qa: str, stack: str, offset: int, mode: str = "normal", prefix: str = "cl-strategy-qa-") -> str:
    tree = os.path.realpath(qa)
    backend = ["functions", "langgraph", "backend"]
    frontends = ["frontend-strategy", "frontend-ri"]
    names = backend + (frontends if mode == "adopt" else []) if stack == "app" else \
            ["ds-demo"] if stack == "ds-demo" else backend + frontends + ["ds-demo"]
    ports = {"functions": 7071 + 10 * offset, "langgraph": 2024 + 10 * offset,
             "backend": 8000 + 10 * offset, "frontend-strategy": 5173 + 10 * offset,
             "frontend-ri": 5174 + 10 * offset}
    if "ds-demo" in names:
        try:
            project = pathlib.Path(qa) / "apps/ui/apps/ds-demo/project.json"
            ports["ds-demo"] = int(json.loads(project.read_text())["targets"]["serve"]["options"]["port"])
        except (OSError, ValueError, KeyError, TypeError):
            ports["ds-demo"] = 5175
    owners = listening_processes([ports[name] for name in names])
    snapshot = processes()
    proc = {item["pid"]: item for item in snapshot}
    unit_cache: dict = {}
    found: set[tuple[str, str, str]] = set()
    for name in names:
        pids = owners[ports[name]]
        if pids is None:
            found.add((name, "?", "listener owner unknown"))
            continue
        for pid in pids:
            if unit_for_pid(pid, unit_cache, proc) != prefix + name + ".service":
                found.add((name, str(pid), "listener"))
    # A launcher rooted in the QA tree is foreign even before its port opens.
    for info in snapshot:
        args = info["argv"]
        if info["cwd"] != tree or not any(os.path.basename(x) == "dev-start.sh" for x in args):
            continue
        script = next(i for i, x in enumerate(args) if os.path.basename(x) == "dev-start.sh")
        requested = args[script + 1:]
        default = not requested or "--log" in requested
        shared = bool({"azurite", "keycloak"} & set(requested))
        reason = "dev-start:all" if default else "dev-start:shared" if shared else "dev-start"
        for name in names:
            selected = name in requested or (default and name in ("functions", "backend", "frontend-ri"))
            if selected and unit_for_pid(info["pid"], unit_cache, proc) != prefix + name + ".service" and (mode == "adopt" or reason == "dev-start"):
                found.add((name, str(info["pid"]), reason))
    if "ds-demo" in names:
        for info in snapshot:
            if info["cwd"] == os.path.join(tree, "apps/ui") and any("ds-demo" in arg for arg in info["argv"]):
                if unit_for_pid(info["pid"], unit_cache, proc) != prefix + "ds-demo.service":
                    found.add(("ds-demo", str(info["pid"]), "serve"))
    return "\n".join(f"{pid} ({name}; {reason})" for name, pid, reason in sorted(found))


def _systemctl(argv: list[str]) -> int:
    args = [x for x in argv if x not in ("--user", "--no-block", "--timestamp=unix", "--")]
    if not args:
        raise ValueError("missing action")
    action = args.pop(0)
    if action == "daemon-reload":
        for source in unit_dir().glob("cl-strategy-*.*"):
            if source.suffix in (".service", ".timer"):
                install(source.name)
        return 0
    if action == "show":
        keys: list[str] = []
        value_only = False
        units: list[str] = []
        while args:
            arg = args.pop(0)
            if arg in ("-p", "--property"):
                keys += args.pop(0).split(",")
            elif arg.startswith("-p") and len(arg) > 2:
                keys += arg[2:].split(",")
            elif arg.startswith("--property="):
                keys += arg.split("=", 1)[1].split(",")
            elif arg == "--value":
                value_only = True
            else:
                units.append(arg)
        if len(units) != 1:
            raise ValueError("show needs one unit")
        snap = service_snapshot(units[0])
        if not keys:
            keys = list(snap)
        for key in keys:
            print(snap.get(key, "") if value_only else key + "=" + snap.get(key, ""))
        return 0
    if action == "is-active":
        quiet = "--quiet" in args
        units = [x for x in args if not x.startswith("-")]
        if len(units) != 1:
            raise ValueError("is-active needs one unit")
        state = service_snapshot(units[0]).get("ActiveState", "unknown")
        if not quiet:
            print(state)
        return 0 if state == "active" else 3
    if action in ("enable", "disable", "start", "stop", "restart", "reset-failed"):
        args = [x for x in args if x != "--now"]
        if not args:
            raise ValueError("unit required")
        for unit in args:
            control(action, unit)
        return 0
    raise ValueError(f"unsupported systemctl action: {action}")


def _journalctl(argv: list[str]) -> int:
    args = [x for x in argv if x not in ("--user", "--no-pager", "-o", "cat")]
    units: list[str] = []
    count = 80
    follow = False
    i = 0
    while i < len(args):
        if args[i] == "-u":
            units.append(args[i + 1]); i += 2
        elif args[i] == "-n":
            count = int(args[i + 1]); i += 2
        elif args[i] == "-f":
            follow = True; i += 1
        else:
            raise ValueError(f"unsupported journalctl argument: {args[i]}")
    if not units:
        raise ValueError("unit required")
    files = [state_dir() / "logs" / (unit + ".log") for unit in units]
    def tail() -> list[str]:
        rows: list[str] = []
        for file in files:
            try:
                rows += file.read_text(errors="replace").splitlines()
            except OSError:
                pass
        return rows[-count:]
    previous = tail()
    print("\n".join(previous), flush=True)
    if follow:
        while True:
            time.sleep(0.5)
            rows = tail()
            if rows != previous:
                added = rows[len(previous):] if rows[:len(previous)] == previous else rows
                print("\n".join(added), flush=True)
                previous = rows
    return 0


def main(argv: list[str] | None = None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    try:
        if not argv:
            raise ValueError("expected systemctl, journalctl, or run-unit")
        mode, *args = argv
        if mode == "process-info":
            print(json.dumps(process_info(int(args[0]))))
            return 0
        if mode == "processes":
            print(json.dumps(processes()))
            return 0
        if mode == "foreign-listeners":
            print(foreign_listeners(args[0], args[1], int(args[2]), args[3] if len(args) > 3 else "normal",
                                    args[4] if len(args) > 4 else "cl-strategy-qa-"))
            return 0
        if mode == "boot-identity":
            print(json.dumps(boot_identity()))
            return 0
        if mode == "run-unit":
            return _runner(args[0])
        if not is_macos():
            return subprocess.call([mode, *args])
        if mode == "systemctl":
            return _systemctl(args)
        if mode == "journalctl":
            return _journalctl(args)
        raise ValueError(mode)
    except (ValueError, RuntimeError, OSError, subprocess.TimeoutExpired) as error:
        print(f"overseer platform: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
