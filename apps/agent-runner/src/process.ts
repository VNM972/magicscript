import { spawnSync } from 'node:child_process';

export function stopProcessTree(pid: number): void {
  if (!Number.isInteger(pid) || pid <= 0) return;

  if (process.platform === 'win32') {
    spawnSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'ignore',
    });
    return;
  }

  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    // The process may have exited between the timeout and cleanup.
  }
}
