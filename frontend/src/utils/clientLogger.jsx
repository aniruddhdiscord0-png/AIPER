import API_URL from './api';
import axios from 'axios';

/**
 * ClientLogger - batches telemetry and errors to send to the backend.
 * Uses a debounce/batching mechanism to prevent spamming the API.
 */
class ClientLogger {
  constructor() {
    this.buffer = [];
    this.timeout = null;
    this.batchSize = 20;
    this.flushInterval = 5000; // 5 seconds
  }

  log(level, event, message, error = null) {
    const entry = {
      level,
      event,
      message,
      timestamp: new Date().toISOString(),
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    this.buffer.push(entry);

    if (this.buffer.length >= this.batchSize) {
      this.flush();
    } else if (!this.timeout) {
      this.timeout = setTimeout(() => this.flush(), this.flushInterval);
    }
  }

  info(event, message) {
    this.log('info', event, message);
  }

  warn(event, message) {
    this.log('warn', event, message);
  }

  error(event, message, err) {
    this.log('error', event, message, err);
  }

  async flush() {
    if (this.buffer.length === 0) return;

    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }

    const entriesToSend = [...this.buffer];
    this.buffer = [];

    try {
      // Don't use the standard fetchWithCache since we don't want cache or spinner
      await axios.post(`${API_URL}/api/logs/client`, { entries: entriesToSend });
    } catch (err) {
      // If logging fails, fall back to console but don't re-buffer 
      // (prevents infinite loops if the log endpoint is down)
      console.error('Failed to send telemetry to backend:', err);
    }
  }
}

export const logger = new ClientLogger();

/**
 * React Error Boundary to catch UI crashes
 */
import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    logger.error('UI_CRASH', 'React component tree crashed', {
      name: error.name,
      message: error.message,
      stack: `${error.stack}\n\nComponent Stack:\n${errorInfo.componentStack}`
    });
    // Force immediate flush for crashes
    logger.flush();
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
          <h2>Something went wrong.</h2>
          <p>An unexpected error occurred in the interface. Our team has been notified.</p>
          <button 
            onClick={() => window.location.reload()}
            style={{ padding: '8px 16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '1rem' }}
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
