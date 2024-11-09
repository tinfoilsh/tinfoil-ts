import { describe, test, expect, beforeEach } from 'vitest';
import { AnalyticsClient } from '../src/client';

describe('Session Duration Bucketing', () => {
    let client: AnalyticsClient;

    beforeEach(() => {
        // Create a new client instance before each test
        client = new AnalyticsClient({
            domain: 'example.com'
        });
    });

    // Access the private bucketTime method using type assertion
    const bucketTime = (client: any, timeInMs: number, interval: number, numBuckets: number) => {
        return client.bucketTime(timeInMs, interval, numBuckets);
    };

    describe('bucketTime', () => {
        // Test configuration
        const interval = 10; // 10 second intervals
        const numBuckets = 5; // 5 buckets (0-4)

        test('should place durations into correct buckets', () => {
            const testCases = [
                { duration: 5000, expected: 0 },    // 5s -> bucket 0 (0-10s)
                { duration: 15000, expected: 1 },   // 15s -> bucket 1 (10-20s)
                { duration: 25000, expected: 2 },   // 25s -> bucket 2 (20-30s)
                { duration: 35000, expected: 3 },   // 35s -> bucket 3 (30-40s)
                { duration: 45000, expected: 4 },   // 45s -> bucket 4 (40-50s)
                { duration: 55000, expected: 4 },   // 55s -> bucket 4 (overflow)
            ];

            testCases.forEach(({ duration, expected }) => {
                const result = bucketTime(client, duration, interval, numBuckets);
                expect(result).toBe(expected);
            });
        });

        test('should handle edge cases', () => {
            // Test exact boundaries
            expect(bucketTime(client, 0, interval, numBuckets)).toBe(0);          // Start of first bucket
            expect(bucketTime(client, 10000, interval, numBuckets)).toBe(1);      // Start of second bucket
            expect(bucketTime(client, 49999, interval, numBuckets)).toBe(4);      // End of last bucket

            // Test overflow
            expect(bucketTime(client, 100000, interval, numBuckets)).toBe(4);     // Way over max

            // Test edge cases
            expect(bucketTime(client, 9999, interval, numBuckets)).toBe(0);       // Just before bucket boundary
            expect(bucketTime(client, 10001, interval, numBuckets)).toBe(1);      // Just after bucket boundary
        });

        test('should handle different interval sizes', () => {
            // Test with 5 second intervals
            expect(bucketTime(client, 7500, 5, numBuckets)).toBe(1);    // 7.5s -> bucket 1 (5-10s)

            // Test with 20 second intervals
            expect(bucketTime(client, 30000, 20, numBuckets)).toBe(1);  // 30s -> bucket 1 (20-40s)

            // Test with 1 minute intervals
            expect(bucketTime(client, 150000, 60, numBuckets)).toBe(2); // 2.5min -> bucket 2 (2-3min)
        });

        test('should handle different numbers of buckets', () => {
            // Test with 3 buckets
            expect(bucketTime(client, 25000, 10, 3)).toBe(2);   // 25s -> bucket 2 (last bucket)
            expect(bucketTime(client, 35000, 10, 3)).toBe(2);   // 35s -> bucket 2 (overflow)

            // Test with 10 buckets
            expect(bucketTime(client, 25000, 10, 10)).toBe(2);  // 25s -> bucket 2 (20-30s)
            expect(bucketTime(client, 95000, 10, 10)).toBe(9);  // 95s -> bucket 9 (last bucket)
        });

        test('should handle extreme values', () => {
            // Test very small values
            expect(bucketTime(client, 1, interval, numBuckets)).toBe(0);

            // Test very large values
            expect(bucketTime(client, Number.MAX_SAFE_INTEGER, interval, numBuckets)).toBe(4);

            // Test with large intervals
            const hourInSeconds = 3600;
            expect(bucketTime(client, 2 * hourInSeconds * 1000, hourInSeconds, numBuckets)).toBe(2);
        });
    });
});