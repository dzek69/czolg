import { EVENTS, Queue } from "queue-system";
import { ApiClient, RequestType } from "api-reach";

import { Job } from "./Job.js";

class Crawler<T> {
    private readonly _q: Queue;

    private readonly _results: T[];

    private readonly _api: ApiClient;

    public constructor() {
        this._q = new Queue({ concurrency: 2 });
        this._api = new ApiClient({
            type: RequestType.text,
        });

        this._results = [];
    }

    public start(url: string) {
        return new Job<T>(this, { url }, {
            queue: this._q,
            api: this._api,
        }, {
            onResult: this._saveResult,
        });
    }

    private readonly _saveResult = (result: T) => {
        this._results.push(result);
    };

    public results() {
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

// @TODO size limit, test for content type, support for fetch options

export {
    Crawler,
};

export type {
    Job,
};
