import { test, expect, type Page } from '@playwright/test';

test.describe('Tinfoil Analytics', () => {
    test.beforeEach(async ({ page }) => {
        // Capture console errors
        await page.addInitScript(() => {
            (window as any).consoleErrors = [];
            const originalConsoleError = console.error;
            console.error = (...args: any[]) => {
                (window as any).consoleErrors.push(args.map(arg => String(arg)).join(' '));
                originalConsoleError(...args);
            };
        });
    });

    test('fetches configuration successfully', async ({ page }) => {
        await page.goto('/e2e/index.html');

        // Wait for the client to fetch the configuration
        await page.waitForFunction(() => typeof (window as any).TinfoilAnalytics !== 'undefined');

        // Check that the client has fetched the configuration
        const configFetched = await page.evaluate(() => {
            return typeof (window as any).TinfoilAnalytics.globalConfig !== 'undefined';
        });

        expect(configFetched).toBeTruthy();
    });

    test('handles configuration fetch failure', async ({ page }) => {
        // Mock failed configuration fetch
        await page.route('**/domains/*/config', route => {
            route.abort();
        });

        await page.goto('/e2e/index.html');

        // Wait for the client to attempt to fetch the configuration
        await page.waitForTimeout(1000);

        // Check that the client handled the failure
        const configFetched = await page.evaluate(() => {
            return (window as any).TinfoilAnalytics && (window as any).TinfoilAnalytics.globalConfig === null;
        });

        expect(configFetched).toBeTruthy();

        // Check for error logs
        const errorLogged = await page.evaluate(() => {
            return (window as any).consoleErrors.some(error => error.includes('Error fetching config'));
        });

        expect(errorLogged).toBeTruthy();
    });

    test('does not track events multiple times due to caching', async ({ page }) => {
        // Mock configuration with 'visit' event
        await page.route('**/domains/*/config', route => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    leaderUrl: 'https://leader.example.com',
                    helperUrl: 'https://helper.example.com',
                    metrics: {
                        visit: {
                            aggregationConfig: {
                                taskId: 'qI6WDNyqrMh9heMFu4TPd8AMmBC6mYJ6zcl6s9tpQv8',
                                type: 'count',
                                timePrecision: 3600,
                                vdafConfig: {}
                            }
                        }
                    }
                })
            });
        });

        await page.goto('/e2e/index.html');

        // Wait for initial tracking
        await page.waitForTimeout(1000);

        // Clear network entries
        await page.evaluate(() => performance.clearResourceTimings());

        // Attempt to track page visit again
        await page.evaluate(() => {
            (window as any).TinfoilAnalytics.trackPageVisit();
        });

        // Wait a bit
        await page.waitForTimeout(1000);

        // Check that no additional requests were made
        const requestCount = await page.evaluate(() => {
            return performance.getEntriesByType('resource')
                .filter(entry => entry.name.includes('tinfoil.sh')).length;
        });

        expect(requestCount).toBe(0);
    });

    test('tracks custom events on button click', async ({ page }) => {
        await page.goto('/e2e/index.html');

        // Get initial request count
        const initialRequests = await page.evaluate(() => {
            const performance = window.performance;
            return performance.getEntriesByType('resource')
                .filter(entry => entry.name.includes('tinfoil.sh')).length;
        });

        // Click the button that should trigger tracking
        await page.click('button.tinfoil-event-name\\=Create\\+Survey');

        // Wait a bit and check for new requests
        await page.waitForTimeout(1000);

        const finalRequests = await page.evaluate(() => {
            const performance = window.performance;
            return performance.getEntriesByType('resource')
                .filter(entry => entry.name.includes('tinfoil.sh')).length;
        });

        expect(finalRequests).toBeGreaterThan(initialRequests);
    });

    test('tracks page visits', async ({ page }) => {
        await page.goto('/e2e/index.html');

        // Wait for initial tracking to complete
        await page.waitForTimeout(1000);

        // Check session storage for visit flag
        const hasVisitFlag = await page.evaluate(() => {
            return window.sessionStorage.getItem('tinfoil-page-visit') === 'true';
        });

        expect(hasVisitFlag).toBeTruthy();
    });

    test('tracks engagement events', async ({ page }) => {
        await page.goto('/e2e/index.html');

        // Wait for initial tracking to complete
        await page.waitForTimeout(1000);

        // Click on the page to trigger engagement
        await page.mouse.click(100, 100);

        // Check session storage for engagement flag
        const hasEngagementFlag = await page.evaluate(() => {
            return window.sessionStorage.getItem('tinfoil-engaged');
        });

        expect(hasEngagementFlag).toBe('true');
    });

    test('tracks telemetry data', async ({ page }) => {
        await page.goto('/e2e/index.html');

        // Wait for telemetry tracking to complete
        await page.waitForTimeout(1000);

        // Check session storage for telemetry flags
        const hasTelemetryFlags = await page.evaluate(() => {
            return {
                os: window.sessionStorage.getItem('did-submit-os-type'),
                browser: window.sessionStorage.getItem('did-submit-browser-type'),
                device: window.sessionStorage.getItem('did-submit-device-type')
            };
        });

        expect(hasTelemetryFlags.os).toBe('true');
        expect(hasTelemetryFlags.browser).toBe('true');
        expect(hasTelemetryFlags.device).toBe('true');
    });

    test('handles session tracking', async ({ page }) => {
        await page.goto('/e2e/index.html');

        // Simulate page visibility change
        await page.evaluate(() => {
            Object.defineProperty(document, 'visibilityState', {
                value: 'hidden',
                writable: true
            });
            document.dispatchEvent(new Event('visibilitychange'));
        });

        // Wait for session tracking to process
        await page.waitForTimeout(1000);

        // Check network requests through Performance API
        const sessionRequests = await page.evaluate(() => {
            return window.performance.getEntriesByType('resource')
                .filter(entry => entry.name.includes('tinfoil.sh')).length;
        });

        expect(sessionRequests).toBeGreaterThan(0);
    });
});