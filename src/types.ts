export interface DeviceInfo {
    labels: string[];
}

export interface BrowserInfo {
    labels: string[];
}

export interface OsInfo {
    labels: string[];
}

export interface SessionInfo {
    sessionInterval: number; // time granularity in seconds
}

export interface CountryInfo {
    countryIndex: number; // index in histogram
}

export interface VdafConfig {
    sumBitLength?: number | null;
    numBuckets?: number | null;
    proofChunkSize?: number | null;
}

export interface AggregationConfig {
    taskId: string;
    type: string;
    timePrecision: number;
    vdafConfig: VdafConfig;
}

export interface MetricConfig {
    metricsInfo?: any;
    aggregationConfig: AggregationConfig;
}

export interface GlobalConfig {
    leaderUrl: string;
    helperUrl: string;
    metrics: {
        os?: MetricConfig | null;
        browser?: MetricConfig | null;
        device?: MetricConfig | null;
        session?: MetricConfig | null;
        visit?: MetricConfig | null;
        country?: MetricConfig | null;
        [key: string]: MetricConfig | null | undefined;
    };
}

export interface AnalyticsConfig {
    domain: string;
    configEndpoint?: string;
    debug?: boolean;
}
