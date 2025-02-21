import { EVENTS, Queue } from "queue-system";
import { ApiClient, RequestType } from "api-reach";

import { Job } from "./Job.js";

interface Options {
    headers?: Record<string, string>;
}

/**
 * Main class, create an instance, use start() to start a new job, collect results from jobs and collect results with
 * crawler.results().
 */
class Crawler<T> {
    private readonly _q: Queue;

    private readonly _results: T[];

    private readonly _api: ApiClient;

    public constructor({ headers }: Options = {}) {
        this._q = new Queue({ concurrency: 2 });
        this._api = new ApiClient({
            type: RequestType.text,
            fetchOptions: {
                headers: headers ?? {},
            },
        });

        this._results = [];
    }

    /**
     * Start a new job from given url.
     * @param url - URL to start from.
     * @returns Job instance.
     */
    public start(url: string) {
        return new Job<T, string>(this, { url }, {
            queue: this._q,
            api: this._api,
        }, {
            onResult: this._saveResult,
        });
    }

    private readonly _saveResult = (result: T) => {
        this._results.push(result);
    };

    /**
     * Get results from all jobs.
     */
    public results(): Promise<T[]> {
        return new Promise(r => {
            if (!this._q.getQueueSize()) {
                r(this._results);
                return;
            }
            const sizeChange = (...args: unknown[]) => {
                const q = Array.from(args)[0];
                if (q === 0) {
                    r(this._results);
                    this._q.off(EVENTS.QUEUE_SIZE, sizeChange);
                }
            };
            this._q.on(EVENTS.QUEUE_SIZE, sizeChange);
        });
    }
}

// @TODO size limit, test for content type

export {
    Crawler,
};

export type {
    Job,
};
