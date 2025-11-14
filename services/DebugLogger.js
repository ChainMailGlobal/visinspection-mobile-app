/**
 * DebugLogger - Comprehensive error tracking for Live AI
 * Captures errors with full context and stack traces
 */

class DebugLogger {
  constructor() {
    this.logs = [];
    this.errors = [];
    this.maxLogs = 100;
  }

  log(stage, message, data = null) {
    const entry = {
      timestamp: new Date().toISOString(),
      stage,
      message,
      data: data ? JSON.stringify(data, null, 2) : null,
    };
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
    console.log(`[${stage}] ${message}`, data || '');
  }

  error(stage, error, context = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      stage,
      error: {
        message: error?.message || 'Unknown error',
        stack: error?.stack || 'No stack trace',
        name: error?.name || 'Error',
        toString: error?.toString() || String(error),
      },
      context,
    };
    this.errors.push(entry);
    if (this.errors.length > this.maxLogs) {
      this.errors.shift();
    }
    console.error(`[${stage}] ERROR:`, error, context);
  }

  getReport() {
    return {
      logs: this.logs,
      errors: this.errors,
      summary: {
        totalLogs: this.logs.length,
        totalErrors: this.errors.length,
        lastError: this.errors[this.errors.length - 1] || null,
      },
    };
  }

  clear() {
    this.logs = [];
    this.errors = [];
  }
}

export default new DebugLogger();

