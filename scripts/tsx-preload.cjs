// Load before tsx's CommonJS bootstrap so its temporary-directory helper
// does not call the failing Windows os.userInfo() native lookup.
if (typeof process.geteuid !== 'function') {
  Object.defineProperty(process, 'geteuid', {
    configurable: true,
    value: () => 0,
  });
}
