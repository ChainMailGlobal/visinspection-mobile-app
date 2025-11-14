/**
 * ErrorStore - Global error storage for diagnostics
 * Stores runtime errors so diagnostics can report them
 */

class ErrorStore {
  constructor() {
    this.errors = [];
    this.maxErrors = 10; // Keep last 10 errors
  }

  /**
   * Record an error from ErrorBoundary
   */
  recordError(error, errorInfo) {
    const errorRecord = {
      timestamp: new Date().toISOString(),
      message: error?.message || 'Unknown error',
      stack: error?.stack || 'No stack trace',
      componentStack: errorInfo?.componentStack || 'No component stack',
      fullError: error?.toString() || 'Error object not available',
      errorInfo: errorInfo ? JSON.stringify(errorInfo, null, 2) : null,
    };

    this.errors.push(errorRecord);
    
    // Keep only last maxErrors
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }

    console.log('ErrorStore: Recorded error', errorRecord);
  }

  /**
   * Record a Camera render error
   */
  recordCameraError(error, context = {}) {
    const errorRecord = {
      timestamp: new Date().toISOString(),
      type: 'Camera Render Error',
      message: error?.message || 'Unknown camera error',
      stack: error?.stack || 'No stack trace',
      context,
    };

    this.errors.push(errorRecord);
    
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }

    console.log('ErrorStore: Recorded camera error', errorRecord);
  }

  /**
   * Get all errors
   */
  getErrors() {
    return [...this.errors];
  }

  /**
   * Get latest error
   */
  getLatestError() {
    return this.errors.length > 0 ? this.errors[this.errors.length - 1] : null;
  }

  /**
   * Clear all errors
   */
  clear() {
    this.errors = [];
  }
}

export default new ErrorStore();

