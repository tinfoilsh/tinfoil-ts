import { describe, test, expect, beforeEach, vi } from 'vitest';
import { AnalyticsClient } from '../src/client';

describe('Analytics Metrics Testing', () => {
    let client: AnalyticsClient;
    let mockStorage: { [key: string]: any };

    beforeEach(() => {
        // Mock storage
        mockStorage = {};
        global.sessionStorage = {
            getItem: (key: string) => mockStorage[key] || null,
            setItem: (key: string, value: string) => { mockStorage[key] = value },
            removeItem: (key: string) => delete mockStorage[key],
            clear: () => { mockStorage = {} },
            length: 0,
            key: () => null
        };

        // Mock window object
        global.window = {
            ...global.window,
            sessionStorage: global.sessionStorage,
            navigator: {
                userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            }
        } as any;

        client = new AnalyticsClient({
            domain: 'test.example.com'
        });
    });

    describe('Visit Tracking', () => {
        test('should track first-time visits correctly', async () => {
            // Mock localStorage for unique visitor tracking
            const mockLocalStorage: { [key: string]: string } = {};
            global.localStorage = {
                getItem: (key: string) => mockLocalStorage[key] || null,
                setItem: (key: string, value: string) => { mockLocalStorage[key] = value },
                removeItem: (key: string) => delete mockLocalStorage[key],
                clear: () => { },
                length: 0,
                key: () => null
            };

            // Set up mock config
            (client as any).globalConfig = {
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
            };

            // Mock trackEvent method
            const trackEventSpy = vi.spyOn(client as any, 'trackEvent');

            await client.trackPageVisit();

            expect(trackEventSpy).toHaveBeenCalledWith('visit', true);
            expect(sessionStorage.getItem('tinfoil-page-visit')).toBe('true');
            expect(localStorage.getItem('tinfoil-unique-visit')).toBe('true');
        });

        test('should handle returning visitors correctly', async () => {
            // Mock localStorage for unique visitor tracking
            const mockLocalStorage: { [key: string]: string } = {};
            global.localStorage = {
                getItem: (key: string) => mockLocalStorage[key] || null,
                setItem: (key: string, value: string) => { mockLocalStorage[key] = value },
                removeItem: (key: string) => delete mockLocalStorage[key],
                clear: () => { },
                length: 0,
                key: () => null
            };

            // Set up returning visitor scenario
            localStorage.setItem('tinfoil-unique-visit', 'true');

            // Mock refreshConfig to return success
            (client as any).refreshConfig = vi.fn().mockResolvedValue(true);

            // Set up required configuration
            (client as any).globalConfig = {
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
            };

            const trackEventSpy = vi.spyOn(client as any, 'trackEvent');

            await client.trackPageVisit();

            // Verify visitor was marked as returning (false)
            expect(trackEventSpy).toHaveBeenCalledWith('visit', false);
            // Verify session was marked
            expect(sessionStorage.getItem('tinfoil-page-visit')).toBe('true');
        });

        test('should not track page visit if already tracked in session', async () => {
            // Set up session storage to indicate already tracked
            sessionStorage.setItem('tinfoil-page-visit', 'true');

            const trackEventSpy = vi.spyOn(client as any, 'trackEvent');

            await client.trackPageVisit();

            // Verify no tracking occurred
            expect(trackEventSpy).not.toHaveBeenCalled();
        });
    });

    describe('Country Tracking', () => {
        test('should track country metric with correct index', async () => {
            (client as any).globalConfig = {
                leaderUrl: 'https://leader.example.com',
                helperUrl: 'https://helper.example.com',
                metrics: {
                    country: {
                        metricsInfo: {
                            countryIndex: 5
                        },
                        aggregationConfig: {
                            taskId: 'qI6WDNyqrMh9heMFu4TPd8AMmBC6mYJ6zcl6s9tpQv8',
                            type: 'histogram',
                            timePrecision: 3600,
                            vdafConfig: {
                                numBuckets: 10,
                                proofChunkSize: 1
                            }
                        }
                    }
                }
            };

            const trackEventSpy = vi.spyOn(client as any, 'trackEvent');
            await (client as any).trackCountry();

            expect(trackEventSpy).toHaveBeenCalledWith('country', 5);
            expect(sessionStorage.getItem('did-submit-country')).toBe('true');
        });

        test('should not track country if already tracked in session', async () => {
            sessionStorage.setItem('did-submit-country', 'true');

            const trackEventSpy = vi.spyOn(client as any, 'trackEvent');
            await (client as any).trackCountry();

            expect(trackEventSpy).not.toHaveBeenCalled();
        });
    });
});