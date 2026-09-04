// tsx asks Node for the current OS user while preparing its temporary
// directory. On this Windows machine that native lookup can fail with
// uv_os_get_passwd/ENOMEM even when memory is available. tsx only needs a
// stable identifier here, so provide the non-privileged fallback before tsx
// is imported.
if (typeof process.geteuid !== 'function') {
  Object.defineProperty(process, 'geteuid', {
    configurable: true,
    value: () => 0,
  });
}
