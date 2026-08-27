const ALLOWED = new Set([
  'requestId', 'action', 'environment', 'userKey', 'connectionKey',
  'status', 'reasonCode', 'accountCount', 'durationMs'
]);

export function createSafeLogger(sink = console) {
  function emit(level, event) {
    const safe = {};
    for (const [key, value] of Object.entries(event || {})) {
      if (ALLOWED.has(key) && value !== undefined && value !== null) safe[key] = value;
    }
    sink[level](JSON.stringify(safe));
  }
  return {
    info(event) { emit('info', event); },
    error(event) { emit('error', event); }
  };
}
