type LogLevel = 'log' | 'warn' | 'error';

class DebugLogger {
    private DEBUG: boolean;

    constructor() {
        this.DEBUG = !this.isProduction();
    }

    private isProduction(): boolean {
        if (typeof window === 'undefined') return false;

        if (window.location.protocol === 'file:') {
            return false;
        }

        return (
            window.location.hostname !== 'localhost' &&
            window.location.hostname !== '127.0.0.1' &&
            !window.location.hostname.startsWith('192.168.') &&
            !window.location.hostname.includes('dev') &&
            !window.location.hostname.includes('staging')
        );
    }

    private logWithLevel(level: LogLevel, ...args: any[]): void {
        if (this.DEBUG) {
            console[level](...args);
        }
    }

    log(...args: any[]): void {
        this.logWithLevel('log', ...args);
    }

    warn(...args: any[]): void {
        this.logWithLevel('warn', ...args);
    }

    error(...args: any[]): void {
        this.logWithLevel('error', ...args);
    }
}

export const logger = new DebugLogger();