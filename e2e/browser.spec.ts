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

    test('maintains correct state when accessed from multiple tabs', async ({ browser }) => {
        // Open two pages (tabs)
        const context = await browser.newContext();
        const page1 = await context.newPage();
        const page2 = await context.newPage();

        // Navigate both pages to the test page
        await page1.goto('/e2e/index.html');
        await page2.goto('/e2e/index.html');

        // Wait for clients to initialize
        await Promise.all([
            page1.waitForFunction(() => typeof (window as any).TinfoilAnalytics !== 'undefined'),
            page2.waitForFunction(() => typeof (window as any).TinfoilAnalytics !== 'undefined')
        ]);

        const expectedPath = await page1.evaluate(() => {
            const { leaderUrl, metrics } = (window as any).TinfoilAnalytics.globalConfig;
            const taskId = metrics['Create Survey'].aggregationConfig.taskId;
            return `${leaderUrl}/tasks/${taskId}/reports`;
        });

        // Track the same event in both tabs
        await Promise.all([
            page1.click('button.tinfoil-event-name\\=Create\\+Survey'),
            page2.click('button.tinfoil-event-name\\=Create\\+Survey')
        ]);

        // Wait for events to be processed
        await page1.waitForTimeout(1000);


        // Check that both events were sent without interference
        const [requestsPage1, requestsPage2] = await Promise.all([
            page1.evaluate((expectedPath) => {
                return performance.getEntriesByType('resource')
                    .filter(entry => entry.name.includes(expectedPath)).length;
            }, expectedPath),
            page2.evaluate((expectedPath) => {
                return performance.getEntriesByType('resource')
                    .filter(entry => entry.name.includes(expectedPath)).length;
            }, expectedPath)
        ]);

        expect(requestsPage1).toBe(1);
        expect(requestsPage2).toBe(1);
    });
});
