import { EVENTS, Queue } from "queue-system";
import cheerio from "cheerio";
import { makeArray } from "bottom-line-utils";

import type { ApiClient } from "api-reach";
import type { Cheerio, CheerioAPI } from "cheerio";
import type { Node } from "domhandler"; // eslint-disable-line @typescript-eslint/no-shadow

import type { Crawler } from "./Crawler.js";

interface Options {
    url: string;
}

interface Deps {
    queue: Queue;
    api: ApiClient;
}

interface Callbacks<R> {
    onResult: (result: R) => void;
}

class Job<T> {
    private readonly _crawler: Crawler<T>;

    private readonly _url: string;

    private readonly _deps: Deps;

    private _result: unknown;

    private _resultType: "html" | "elements" | "strings" | "jobs" | "custom" | "none" = "none";

    private readonly _onResult: Callbacks<T>["onResult"];

    private readonly _jobQueue: Queue;

    private _$?: CheerioAPI;

    public constructor(crawler: Crawler<T>, { url }: Options, deps: Deps, callbacks: Callbacks<T>) {
        this._crawler = crawler;
        this._url = url;
        this._deps = deps;
        this._onResult = callbacks.onResult;

        this._jobQueue = new Queue({ concurrency: 1 });

        this._download();
    }

    private _queue(fn: () => Promise<unknown>) {
        const task = this._jobQueue.add(fn);
        this._deps.queue.add(() => task.promise);
    }

    private _download() {
        this._queue(() => this._deps.api.get(this._url).then(r => r.body as string).then((body) => {
            this._result = body;
            this._resultType = "html";
            this._$ = cheerio.load(body);
        }));
        return this;
    }

    private _wait() {
        return new Promise<void>(r => {
            const size = this._jobQueue.getQueueSize();
            if (!size) {
                r();
                return;
            }

            const sizeChange = (...args: unknown[]) => {
                const q = Array.from(args)[0];
                if (q === 0) {
                    r();
                    this._jobQueue.off(EVENTS.QUEUE_SIZE, sizeChange);
                }
            };
            this._jobQueue.on(EVENTS.QUEUE_SIZE, sizeChange);
        });
    }

    public find(selector: string) {
        // eslint-disable-next-line @typescript-eslint/require-await
        this._queue(async () => {
            if (!this._$) {
                throw new Error("Html is missing [?]");
            }
            const elements = this._$(selector);
            this._resultType = "elements";
            this._result = elements;
        });
        return this;
    }

    public click() {
        // eslint-disable-next-line @typescript-eslint/require-await
        this._queue(async () => {
            if (this._resultType !== "elements") { // @TODO add support for clicking on string results - verify if
                // they are urls
                throw new Error("You can run `textContent` only on elements results");
            }
            const elems = this._result as Cheerio<Node>;
            this._resultType = "jobs";
            this._result = elems.map((key, elem) => {
                const href = this._$?.(elem).attr("href") || "";
                return new URL(href, this._url).href;
            }).toArray().map(url => {
                return new Job(this._crawler, { url }, this._deps, { onResult: this._onResult });
            });
        });
        return this;
    }

    public textContent() {
        // eslint-disable-next-line @typescript-eslint/require-await
        this._queue(async () => {
            if (this._resultType !== "elements") {
                throw new Error("You can run `textContent` only on elements results");
            }
            const elems = this._result as Cheerio<Node>;
            this._resultType = "strings";
            this._result = elems.map((key, elem) => {
                return this._$?.(elem).text();
            }).toArray();
        });
        return this;
    }

    public attr(name: string) {
        // eslint-disable-next-line @typescript-eslint/require-await
        this._queue(async () => {
            if (this._resultType !== "elements") {
                throw new Error("You can run `attr` only on elements results");
            }
            const elems = this._result as Cheerio<Node>;
            this._resultType = "strings";
            this._result = elems.map((key, elem) => {
                return this._$?.(elem).attr(name);
            }).toArray();
        });
        return this;
    }

    public async result() {
        await this._wait();
        if (Array.isArray(this._result)) {
            this._result.forEach(r => {
                this._onResult(r as T);
            });
            return this;
        }
        this._onResult(this._result as T);
        return this;
    }

    public async get() {
        await this._wait();
        return makeArray(this._result);
    }

    public async each(cb: (result: unknown) => void) {
        const a = await this.get();
        a.forEach(cb);
    }

    public map<TP>(cb: (result: unknown) => TP) {
        // eslint-disable-next-line @typescript-eslint/require-await
        this._queue(async () => {
            if (Array.isArray(this._result)) {
                this._resultType = "custom";
                this._result = this._result.map(cb);
                return;
            }

            if (this._resultType === "elements") {
                const elems = this._result as Cheerio<Node>;

                this._result = elems.map((key, elem) => {
                    return cb(this._$?.(elem));
                }).toArray();
                return;
            }

            throw new Error("You can run `map` only after array returning method");
        });
        return this;
    }

    public resolve() {
        // eslint-disable-next-line @typescript-eslint/require-await
        this._queue(async () => {
            if (this._resultType !== "strings") {
                throw new Error("You can run `resolve` only on strings results");
            }

            this._resultType = "strings";
            this._result = (this._result as string[]).map((s) => {
                return new URL(s, this._url).href;
            });
        });
        return this;
    }
}

export {
    Job,
};
