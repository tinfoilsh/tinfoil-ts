import { Task } from '@divviup/dap';
import type { AnalyticsConfig, GlobalConfig, MetricConfig } from './types';
import { getConfig, DEFAULT_CONFIG_ENDPOINT } from './config';
import { logger } from './debugLogger';
import { UAParser } from 'ua-parser-js'; // Import UAParser for user-agent parsing

export class AnalyticsClient {
    private config: AnalyticsConfig;
    private globalConfig: GlobalConfig | null = null;
    private tasks: Map<string, Task<any, any>> = new Map();

    constructor(config: AnalyticsConfig) {
        this.config = {
            configEndpoint: DEFAULT_CONFIG_ENDPOINT,
            debug: false,
            ...config,
        };
    }

    async init(): Promise<void> {
        await this.initTracking();
    }

    private async initTracking(): Promise<void> {
        const configSuccess = await this.refreshConfig();
        if (!configSuccess) {
            logger.error('Tinfoil: Failed to refresh config');
            return;
        }

        this.startSessionTracking();
        this.setupCustomEventTracking();
        this.setupBounceTracking();

        const results = await Promise.allSettled([
            this.trackPageVisit(),
            this.trackCountry(),
            this.trackTelemetry(),
        ]);

        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                const functionName = ['trackPageVisit', 'trackCountry', 'trackTelemetry'][index];
                logger.error(`Tinfoil: ${functionName} failed:`, result.reason);
            }
        });
    }

    private async refreshConfig(): Promise<boolean> {
        if (this.globalConfig !== null) return true; // Already have config
        try {
            const config = await getConfig(
                this.config.domain,
                this.config.configEndpoint,
            );
            if (config) {
                this.globalConfig = config;
                logger.log('Tinfoil: Global config fetched successfully:', config);
                return true;
            } else {
                logger.error('Failed to fetch global config');
                return false;
            }
        } catch (error) {
            logger.error('Error fetching global config:', error);
            return false;
        }
    }

    private async getTask(eventName: string): Promise<Task<any, any> | null> {
        // Try to get cached task
        const cachedTask = this.tasks.get(eventName);
        if (cachedTask) {
            return cachedTask;
        }

        // Make sure we have config
        if (!this.globalConfig && !(await this.refreshConfig())) {
            return null;
        }

        const eventConfig = this.globalConfig?.metrics[eventName];
        if (!eventConfig) {
            logger.error(`Tinfoil: No configuration found for event: ${eventName}`);
            return null;
        }

        const task = await this.createTask(eventConfig);
        if (task) {
            this.tasks.set(eventName, task);
        }
        return task;
    }

    private async createTask(eventConfig: MetricConfig): Promise<Task<any, any> | null> {
        const { taskId, timePrecision, type, vdafConfig } = eventConfig.aggregationConfig;
        const { leaderUrl, helperUrl } = this.globalConfig!;

        if (type === 'count') {
            // For 'count', measurement is a boolean
            type Spec = { type: 'count' };
            type Measurement = boolean;

            return new Task<Spec, Measurement>({
                type: 'count',
                id: taskId,
                leader: leaderUrl,
                helper: helperUrl,
                timePrecisionSeconds: timePrecision,
            });
        } else if (type === 'histogram') {
            if (!vdafConfig) {
                throw new Error('Invalid histogram configuration: vdafConfig is undefined');
            }

            const { numBuckets, proofChunkSize } = vdafConfig;
            if (numBuckets == null || proofChunkSize == null) {
                throw new Error('Invalid histogram configuration: numBuckets or proofChunkSize is null or undefined');
            }

            // At this point, TypeScript knows numBuckets and proofChunkSize are numbers

            // For 'histogram', measurement is a number (the bucket index)
            type Spec = { type: 'histogram'; length: number; chunkLength: number };
            type Measurement = number;

            return new Task<Spec, Measurement>({
                type: 'histogram',
                id: taskId,
                leader: leaderUrl,
                helper: helperUrl,
                timePrecisionSeconds: timePrecision,
                length: numBuckets,
                chunkLength: proofChunkSize,
            });
        }

        logger.error(`Unsupported event type: ${type}`);
        return null;
    }


    async trackEvent(eventName: string, value?: number | boolean): Promise<void> {
        const task = await this.getTask(eventName);
        if (!task) {
            logger.error(`Tinfoil: No configuration found for event: ${eventName}`);
            return;
        }

        logger.log(`Tinfoil: Tracking event: ${eventName} with value: ${value}`);

        try {
            await task.sendMeasurement(value !== undefined ? value : true);
            logger.log(`Tinfoil: Event '${eventName}' tracked successfully`);
        } catch (error) {
            logger.error(`Tinfoil: Error tracking event '${eventName}':`, error);
        }
    }

    async trackPageVisit(): Promise<void> {
        if (typeof window === 'undefined' || !window.sessionStorage) return;
        if (sessionStorage.getItem('tinfoil-page-visit')) return;

        const success = await this.refreshConfig();
        if (!success) return;
        if (!this.globalConfig?.metrics.visit) return;

        sessionStorage.setItem('tinfoil-page-visit', 'true');
        logger.log('Tinfoil: Tracking page visit');

        const isUniqueVisit = !localStorage.getItem('tinfoil-unique-visit');
        if (isUniqueVisit) {
            localStorage.setItem('tinfoil-unique-visit', 'true');
            logger.log('Tinfoil: New unique visitor');
        } else {
            logger.log('Tinfoil: Returning visitor');
        }

        await this.trackEvent('visit', isUniqueVisit);
    }

    private async trackCountry(): Promise<void> {
        if (typeof window === 'undefined' || !window.sessionStorage) return;
        if (sessionStorage.getItem('did-submit-country')) return;

        const success = await this.refreshConfig();
        if (!success) return;
        const countryConfig = this.globalConfig?.metrics.country;
        if (!countryConfig || !countryConfig.metricsInfo) return;

        sessionStorage.setItem('did-submit-country', 'true');
        logger.log('Tinfoil: Tracking country');

        const index = countryConfig.metricsInfo.countryIndex;

        await this.trackEvent('country', index);
    }

    async trackTelemetry(): Promise<void> {
        if (typeof window === 'undefined') return;

        const success = await this.refreshConfig();
        if (!success) return;

        const userAgent = window.navigator.userAgent;
        const parser = new UAParser(userAgent);

        const browserName = parser.getBrowser().name;
        const osName = parser.getOS().name;
        let deviceType = parser.getDevice().type || 'Desktop';

        await Promise.allSettled([
            this.sendBrowserType(browserName),
            this.sendOSType(osName),
            this.sendDeviceType(deviceType),
        ]);
    }

    private async sendOSType(osType: string | undefined): Promise<void> {
        try {
            if (!this.globalConfig?.metrics.os) return;
            if (sessionStorage.getItem('did-submit-os-type')) return;
            if (!osType) {
                logger.log('Tinfoil: OS type is undefined');
                return;
            }

            sessionStorage.setItem('did-submit-os-type', 'true');
            logger.log('Tinfoil: Tracking OS type');

            const osMetrics = this.globalConfig.metrics.os;
            const osTypes = osMetrics.metricsInfo?.labels;
            if (!osTypes) return;

            let osTypeIndex = osTypes.findIndex((name: string) =>
                osType.toLowerCase().includes(name.toLowerCase())
            );
            if (osTypeIndex === -1) osTypeIndex = osTypes.length - 1;

            logger.log('Tinfoil: OS type is', osTypes[osTypeIndex]);

            await this.trackEvent('os', osTypeIndex);
        } catch (error) {
            logger.error('Error in sendOSType:', error);
        }
    }


    private async sendBrowserType(browserType: string | undefined): Promise<void> {
        try {
            if (!this.globalConfig?.metrics.browser) return;
            if (sessionStorage.getItem('did-submit-browser-type')) return;
            if (!browserType) {
                logger.log('Tinfoil: Browser type is undefined');
                return;
            }

            sessionStorage.setItem('did-submit-browser-type', 'true');
            logger.log('Tinfoil: Tracking browser type');

            const browserMetrics = this.globalConfig.metrics.browser;
            const browserTypes = browserMetrics.metricsInfo?.labels;
            if (!browserTypes) return;

            let browserTypeIndex = browserTypes.findIndex((name: string) =>
                browserType.toLowerCase().includes(name.toLowerCase())
            );
            if (browserTypeIndex === -1) browserTypeIndex = browserTypes.length - 1;

            logger.log('Tinfoil: Browser type is', browserTypes[browserTypeIndex]);

            await this.trackEvent('browser', browserTypeIndex);
        } catch (error) {
            logger.error('Error in sendBrowserType:', error);
        }
    }


    private async sendDeviceType(deviceType: string | undefined): Promise<void> {
        try {
            if (!this.globalConfig?.metrics.device) return;
            if (sessionStorage.getItem('did-submit-device-type')) return;
            if (!deviceType) {
                logger.log('Tinfoil: Device type is undefined');
                return;
            }

            sessionStorage.setItem('did-submit-device-type', 'true');
            logger.log('Tinfoil: Tracking device type');

            const deviceMetrics = this.globalConfig.metrics.device;
            const deviceTypes = deviceMetrics.metricsInfo?.labels;
            if (!deviceTypes) return;

            let deviceTypeIndex = deviceTypes.findIndex((name: string) =>
                deviceType.toLowerCase().includes(name.toLowerCase())
            );
            if (deviceTypeIndex === -1) deviceTypeIndex = deviceTypes.length - 1;

            logger.log('Tinfoil: Device type is', deviceTypes[deviceTypeIndex]);

            await this.trackEvent('device', deviceTypeIndex);
        } catch (error) {
            logger.error('Error in sendDeviceType:', error);
        }
    }

    startSessionTracking(): void {
        if (typeof window === 'undefined') return;

        let sessionStart = Date.now();

        const endSession = async () => {
            const duration = Date.now() - sessionStart;
            if (this.globalConfig?.metrics.session) {
                const sessionConfig = this.globalConfig.metrics.session;
                if (!sessionConfig.metricsInfo) return;
                const { sessionInterval } = sessionConfig.metricsInfo;

                const vdafConfig = sessionConfig.aggregationConfig.vdafConfig;
                if (!vdafConfig) return;
                const numBuckets = vdafConfig.numBuckets;
                if (!numBuckets) return;

                const bucket = this.bucketTime(duration, sessionInterval!, numBuckets);

                logger.log(`Tinfoil: Session duration bucketed as ${bucket}`);
                await this.trackEvent('session', bucket);
            }
        };

        document.addEventListener('visibilitychange', async () => {
            if (document.visibilityState === 'hidden') {
                await endSession();
            } else {
                sessionStart = Date.now();
            }
        });

        window.addEventListener('beforeunload', () => {
            endSession().catch(console.error);
        });
    }

    private bucketTime(timeInMs: number, interval: number, numBuckets: number): number {
        const intervalInMs = interval * 1000; // Convert seconds to milliseconds

        if (timeInMs > numBuckets * intervalInMs) {
            return numBuckets - 1; // Last bucket if time exceeds the maximum
        }

        return Math.floor(timeInMs / intervalInMs);
    }

    private setupCustomEventTracking(): void {
        if (typeof document === 'undefined') return;

        document.addEventListener('click', (e) => {
            let target = e.target as HTMLElement | null;
            while (target && target !== document.body) {
                const className = Array.from(target.classList).find(cls => cls.startsWith('tinfoil-event-name='));
                if (className) {
                    const parts = className.split('=');
                    if (parts.length > 1) {
                        const eventName = parts[1]!.replace(/\+/g, ' ');
                        this.trackEvent(eventName);
                    }
                    break;
                }
                target = target.parentElement;
            }
        });

        document.addEventListener('submit', (e) => {
            const form = e.target as HTMLFormElement;
            const className = Array.from(form.classList).find(cls => cls.startsWith('tinfoil-event-name='));
            if (className) {
                const parts = className.split('=');
                if (parts.length > 1) {
                    const eventName = parts[1]!.replace(/\+/g, ' ');
                    this.trackEvent(eventName);
                }
            }
        });
    }

    private setupBounceTracking(): void {
        if (typeof document === 'undefined') return;

        const interactionEvents = ['click', 'keypress'];

        const handleInteraction = () => {
            // Remove listeners after first interaction
            interactionEvents.forEach(event => {
                document.removeEventListener(event, handleInteraction);
            });
            logger.log('Tinfoil: User interaction detected');

            // Only fire engagement event once per session
            if (!sessionStorage.getItem('tinfoil-engaged')) {
                sessionStorage.setItem('tinfoil-engaged', 'true');
                this.trackEvent('engaged');
            }
        };

        // Add interaction listeners
        interactionEvents.forEach(event => {
            document.addEventListener(event, handleInteraction);
        });
    }
}
