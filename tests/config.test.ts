import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getConfig } from '../src/config';

describe('getConfig', () => {
    beforeEach(() => {
        global.fetch = vi.fn();
    });

    it('should fetch and return global config', async () => {
        const sampleData = {
            leaderUrl: 'https://leader.example.com',
            helperUrl: 'https://helper.example.com',
            metrics: {
                browser: null,
                country: null,
                device: null,
                visit: null,
                session: null,
                os: {
                    metricsInfo: {
                        labels: ['Windows', 'MacOS', 'Linux'],
                    },
                    aggregationConfig: {
                        taskId: 'qI6WDNyqrMh9heMFu4TPd8AMmBC6mYJ6zcl6s9tpQv8',
                        type: 'histogram',
                        timePrecision: 3600,
                        vdafConfig: {
                            numBuckets: 3,
                            proofChunkSize: 1,
                        },
                    },
                },
            },
        };

        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue(sampleData),
        });

        const config = await getConfig('test-domain');

        expect(config).toEqual(sampleData);
    });

    it('should return null if fetch fails', async () => {
        (global.fetch as any).mockResolvedValue({
            ok: false,
            status: 404,
        });

        const config = await getConfig('test-domain');

        expect(config).toBeNull();
    });

    it('should handle fetch errors', async () => {
        (global.fetch as any).mockRejectedValue(new Error('Network Error'));

        const config = await getConfig('test-domain');

        expect(config).toBeNull();
    });
});
