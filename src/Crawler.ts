import { ApiClient, RequestType } from "api-reach";
import { Queue } from "queue-system";

import type { WaitableJob } from "./Job.js";

import { Job } from "./Job.js";

interface Options {
    headers?: Record<string, string>;
    /**
     * Maximum number of pages downloaded at the same time. Defaults to 2.
     */
    concurrency?: number;
}

/**
 * Main class, create an instance, use start() to start a new job, collect results from jobs and collect results with
 * crawler.results().
 */
class Crawler<T> {
    private readonly _q: Queue;

    private readonly _results: T[];

    private readonly _jobs: WaitableJob[];

    private readonly _api: ApiClient;

    public constructor({ headers, concurrency = 2 }: Options = {}) {
        this._q = new Queue({ concurrency });
        this._api = new ApiClient({
            type: RequestType.text,
            fetchOptions: {
                headers: headers ?? {},
            },
        });

        this._results = [];
        this._jobs = [];
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
            registerJob: this._registerJob,
        }, {
            onResult: this._saveResult,
        });
    }

    private readonly _saveResult = (result: T) => {
        this._results.push(result);
    };

    private readonly _registerJob = (job: WaitableJob) => {
        this._jobs.push(job);
    };

    /**
     * Get results from all jobs.
     */
    public async results(): Promise<T[]> {
        // jobs can spawn more jobs (`click`) while we wait for the earlier ones - they get appended to the list,
        // so a plain index loop picks them up
        for (let i = 0; i < this._jobs.length; i++) {
            await this._jobs[i]?.wait();
        }
        return this._results;
    }
}

// @TODO size limit, test for content type

export {
    Crawler,
};

export type {
    Job,
};
