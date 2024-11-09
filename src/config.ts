import { logger } from './debugLogger';
import type { GlobalConfig, AggregationConfig, MetricConfig } from './types';


export const DEFAULT_CONFIG_ENDPOINT = 'https://api.tinfoil.sh';

// Helper Functions
function isAggregationConfig(data: any): data is AggregationConfig {
    return (
        typeof data === 'object' &&
        data !== null &&
        typeof data.taskId === 'string' &&
        typeof data.type === 'string' &&
        typeof data.timePrecision === 'number' &&
        typeof data.vdafConfig === 'object' &&
        data.vdafConfig !== null &&
        (data.vdafConfig.sumBitLength == null || typeof data.vdafConfig.sumBitLength === 'number') &&
        (data.vdafConfig.numBuckets == null || typeof data.vdafConfig.numBuckets === 'number') &&
        (data.vdafConfig.proofChunkSize == null || typeof data.vdafConfig.proofChunkSize === 'number')
    );
}


function isMetricsInfo(data: any, metricType: string): boolean {
    switch (metricType) {
        case 'os':
        case 'browser':
        case 'device':
            return (
                typeof data === 'object' &&
                Array.isArray(data.labels)
            );
        case 'session':
            return typeof data === 'object' && typeof data.sessionInterval === 'number';
        case 'country':
            return typeof data === 'object' && typeof data.countryIndex === 'number';
        case 'visit':
            return true; // 'visit' might not have metricsInfo
        case 'engaged':
            return true;
        default:
            return false;
    }
}

function isMetric(data: any, metricType: string): data is MetricConfig {
    if (typeof data !== 'object' || data === null) {
        return false;
    }

    if (['os', 'browser', 'device', 'session', 'visit', 'country', 'engaged'].includes(metricType)) {
        return (
            isMetricsInfo(data.metricsInfo, metricType) &&
            isAggregationConfig(data.aggregationConfig)
        );
    }

    // For custom metrics, we only check for the aggregationConfig
    return isAggregationConfig(data.aggregationConfig);
}

function isCustomMetric(data: any): data is MetricConfig {
    return (
        typeof data === 'object' &&
        data !== null &&
        isAggregationConfig(data.aggregationConfig)
    );
}

// Validation Function
function validateConfig(data: any): GlobalConfig {
    if (
        typeof data !== 'object' ||
        data === null ||
        !data.leaderUrl ||
        !data.helperUrl ||
        typeof data.metrics !== 'object' ||
        data.metrics === null
    ) {
        throw new Error('Invalid configuration format');
    }

    // Create a metrics object with the correct type
    const metrics: GlobalConfig['metrics'] = {
        os: null,
        browser: null,
        device: null,
        session: null,
        visit: null,
        country: null,
    };

    // Add all fetched metrics, including custom ones
    for (const [key, value] of Object.entries(data.metrics)) {
        if (value === null) {
            metrics[key] = null;
            continue;
        }

        if (isMetric(value, key)) {
            metrics[key] = value as any;
        } else if (isCustomMetric(value)) {
            metrics[key] = value;
        } else {
            logger.warn(`Invalid metric configuration for ${key}`);
        }
    }

    return {
        leaderUrl: data.leaderUrl,
        helperUrl: data.helperUrl,
        metrics,
    };
}

// Main Function
export async function getConfig(
    domain: string,
    endpoint: string = DEFAULT_CONFIG_ENDPOINT
): Promise<GlobalConfig | null> {
    try {
        const url = new URL(`domains/${domain}/config`, endpoint);
        logger.log(`Fetching global config from URL: ${url}`);
        const response = await fetch(url.toString());

        if (!response.ok) {
            logger.error(`HTTP error! status: ${response.status}`);
            return null;
        }

        const data = await response.json();
        return validateConfig(data);
    } catch (error) {
        logger.error('Error fetching config:', error);
        return null;
    }
}
