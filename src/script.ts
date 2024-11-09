import { AnalyticsClient } from './client';

declare global {
    interface Window {
        TinfoilAnalytics?: AnalyticsClient;
    }
}

async function initialize(): Promise<void> {
    const script = document.currentScript as HTMLScriptElement;
    const domain = script?.dataset['param'];

    if (!domain) {
        console.error('Tinfoil: No domain provided');
        return;
    }

    const client = new AnalyticsClient({ domain: domain });

    try {
        await client.init();

        // Make client available globally
        window.TinfoilAnalytics = client;
    } catch (error) {
        console.error('Tinfoil: Failed to initialize', error);
    }
}

initialize().catch(console.error);
