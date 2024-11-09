// ua-parser.test.ts

import { test, expect } from '@playwright/test';
import { UAParser } from 'ua-parser-js';

test.describe('UAParser Integration Test with Playwright', () => {
    test('UAParser correctly parses user-agent strings in Chromium', async ({ browser }) => {
        const context = await browser.newContext();
        const page = await context.newPage();

        // Navigate to a blank page
        await page.goto('about:blank');

        // Get the user-agent string from the page
        const userAgent = await page.evaluate(() => navigator.userAgent);
        console.log('Chromium User-Agent:', userAgent);

        // Parse the user-agent string
        const parser = new UAParser(userAgent);
        const result = parser.getResult();

        // Log the parsed result
        console.log('Parsed Result:', result);

        // Assert that browser and OS names are defined
        expect(result.browser.name).toBeDefined; // should be chrome;
        expect(result.os.name).toBeDefined();

        // Close the context
        await context.close();
    });
});
