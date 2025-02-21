import { EVENTS, Queue } from "queue-system";
import { load as $load } from "cheerio";
import { makeArray } from "bottom-line-utils";

import type { ApiClient } from "api-reach";
import type { Cheerio, CheerioAPI } from "cheerio";
import type { Node } from "domhandler"; // eslint-disable-line @typescript-eslint/no-shadow
import type { Crawler } from "./Crawler.js";

import { instanceOfCheerio } from "./utils.js";

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

type Elements = Cheerio<Node>;

class Job<ExpR, CR = never> {
    private readonly _crawler: Crawler<ExpR>;

    private readonly _url: string;

    private readonly _deps: Deps;

    private _result: unknown;

    private _resultType: "html" | "elements" | "strings" | "jobs" | "custom" | "none" = "none";

    private readonly _onResult: Callbacks<ExpR>["onResult"];

    private readonly _jobQueue: Queue;

    private _$?: CheerioAPI;

    /**
     * Saves current result to the crawler
     */
    public result: CR extends ExpR ? () => Promise<this> : never;

    /**
     * Directly returns you results if you need them.
     */
    public get: CR extends ExpR ? () => Promise<CR[]> : never;

    /**
     * Gets text content of selected elements. No HTML is returned, only text.
     */
    public textContent: CR extends Elements ? () => Job<ExpR, string> : never;

    /**
     * "Clicks" on found elements (must be strings), creating new job for each URL.
     * Use `.each()` to iterate over the results.
     */
    public click: CR extends Elements ? () => Job<ExpR, Job<ExpR, string>> : never;

    /**
     * Gets attribute of found elements
     */
    public attr: CR extends Elements ? (name: string) => Job<ExpR, string> : never;

    /**
     * Makes the collected URLs absolute, by using the job URL as a base.
     * i.e. if you get attr("href") and the value is `/subpage`, it will be resolved to `https://example.com/subpage`.
     */
    public resolve: CR extends string ? () => Job<ExpR, string> : never;

    // eslint-disable-next-line max-lines-per-function
    public constructor(crawler: Crawler<ExpR>, { url }: Options, deps: Deps, callbacks: Callbacks<ExpR>) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        this.result = (async () => {
            await this._wait();
            if (Array.isArray(this._result)) {
                this._result.forEach(r => {
                    this._onResult(r as ExpR);
                });
                return this;
            }
            this._onResult(this._result as ExpR);
            return this;
        }) as any; // eslint-disable-line @typescript-eslint/no-explicit-any

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        this.textContent = (() => {
            // eslint-disable-next-line @typescript-eslint/require-await
            this._queue(async () => {
                if (this._resultType !== "elements") {
                    throw new Error("You can run `textContent` only on elements results");
                }
                const elems = this._result as Elements;
                this._resultType = "strings";
                this._result = elems.map((key, elem) => {
                    return this._$?.(elem).text();
                }).toArray();
            });
            return this;
        }) as any; // eslint-disable-line @typescript-eslint/no-explicit-any

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        this.click = (() => {
            // eslint-disable-next-line @typescript-eslint/require-await
            this._queue(async () => {
                if (this._resultType !== "elements") { // @TODO add support for clicking on string results - verify if
                    // they are urls
                    throw new Error("You can run `click` only on elements results");
                }
                const elems = this._result as Elements;
                this._resultType = "jobs";
                this._result = elems.map((key, elem) => {
                    const href = this._$?.(elem).attr("href") || "";
                    return new URL(href, this._url).href;
                }).toArray().map(uurl => {
                    return new Job(this._crawler, { url: uurl }, this._deps, { onResult: this._onResult });
                });
            });
            return this;
        }) as any; // eslint-disable-line @typescript-eslint/no-explicit-any

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        this.attr = ((name: string) => {
            // eslint-disable-next-line @typescript-eslint/require-await
            this._queue(async () => {
                if (this._resultType !== "elements") {
                    throw new Error("You can run `attr` only on elements results");
                }
                const elems = this._result as Elements;
                this._resultType = "strings";
                this._result = elems.map((key, elem) => {
                    return this._$?.(elem).attr(name);
                }).toArray();
            });
            return this;
        }) as any; // eslint-disable-line @typescript-eslint/no-explicit-any

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        this.get = (async () => {
            await this._wait();
            return makeArray(this._result);
        }) as any; // eslint-disable-line @typescript-eslint/no-explicit-any

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        this.resolve = (() => {
            // eslint-disable-next-line @typescript-eslint/require-await
            this._queue(async () => {
                if (this._resultType !== "strings") {
                    throw new Error("You can run `resolve` only on strings results");
                }

                this._resultType = "strings";
                this._result = (this._result as string[]).map((s) => {
                    try {
                        return new URL(s, this._url).href;
                    }
                    catch {
                        return s;
                    }
                });
            });
            return this;
        }) as any; // eslint-disable-line @typescript-eslint/no-explicit-any

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
            this._$ = $load(body);
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

    /**
     * Finds elements in the downloaded HTML. Each time you call it it starts from the beginning.
     * If you want to traverse the tree over already found elements use .map() and call cheerio methods on them.
     * @param selector - css selector
     */
    public find(selector: string): Job<ExpR, Elements> {
        // eslint-disable-next-line @typescript-eslint/require-await
        this._queue(async () => {
            if (!this._$) {
                throw new Error("Page failed to load");
            }
            const elements = this._$(selector);
            this._resultType = "elements";
            this._result = elements;
        });
        // @ts-expect-error TS can't handle this
        return this;
    }

    /**
     * Iterates over collected elements, useful after .click()
     */
    public async each(cb: (result: CR, key: number) => void) {
        const a = await this.get();
        a.forEach(cb);
        return this;
    }

    /**
     * Maps collected elements
     */
    public map<TP>(cb: (result: CR, index: number) => TP): Job<ExpR, TP> {
        // eslint-disable-next-line @typescript-eslint/require-await
        this._queue(async () => {
            // @ts-expect-error TS can't handle this callback, this._result is unknown and making it a CR is even
            // more headache
            this._result = makeArray(this._result).map(cb);
            const allStrings = (this._result as unknown[]).every((r) => typeof r === "string");
            if (allStrings) {
                this._resultType = "strings";
                return;
            }
            const allCheerio = (this._result as unknown[]).every((r) => instanceOfCheerio(r));
            if (allCheerio) {
                this._resultType = "elements";
                return;
            }
            this._resultType = "custom";
        });
        // @ts-expect-error TS can't handle this
        return this;
    }

    public replace<TP>(cb: (result: CR[]) => TP): Job<ExpR, TP> {
        // eslint-disable-next-line @typescript-eslint/require-await
        this._queue(async () => {
            // @ts-expect-error TS can't handle this callback, this._result is unknown and making it a CR is even
            // more headache
            // eslint-disable-next-line callback-return
            this._result = cb(makeArray(this._result));
            if (typeof this._result === "string") {
                this._resultType = "strings";
                return;
            }
            if (instanceOfCheerio(this._result)) {
                this._resultType = "elements";
                return;
            }
            this._resultType = "custom";
        });
        // @ts-expect-error TS can't handle this
        return this;
    }

    /**
     * Filters collected elements
     */
    public filter(cb: (value: CR, index: number, array: unknown[]) => boolean) {
        // eslint-disable-next-line @typescript-eslint/require-await
        this._queue(async () => {
            // @ts-expect-error TS can't handle this callback, this._result is unknown and making it a CR is even
            // more headache
            this._result = makeArray(this._result).filter(cb);
        });
        return this;
    }
}

export type { Elements };
export { Job };
