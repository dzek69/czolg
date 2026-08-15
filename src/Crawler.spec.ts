import http from "http";

import type { AddressInfo } from "net";

import { Crawler } from "./Crawler.js";

const PAGES: Record<string, string> = {
    "/": `<main>
        <h3>Tank One</h3><h3>Tank Two</h3>
        <h2>Heading A</h2><h2>Heading B</h2>
        <a target="_self" href="/package/one">one</a>
        <a target="_self" href="/package/two">two</a>
    </main>`,
    "/package/one": `<h2>one</h2><div id="readme">first readme</div>`,
    "/package/two": `<h2>two</h2><div id="readme">second readme</div>`,
    "/links": `<a href="/403">one</a><a href="/403">two</a>`,
    "/many": `<a href="/slow/1">1</a><a href="/slow/2">2</a><a href="/slow/3">3</a>`
        + `<a href="/slow/4">4</a><a href="/slow/5">5</a><a href="/slow/6">6</a>`,
};

const SLOW_RESPONSE_MS = 100;

const startServer = async () => {
    let inFlight = 0;
    const serverStats = { maxInFlight: 0 };
    const srv = http.createServer((req, res) => {
        if (req.url?.startsWith("/slow/")) {
            inFlight++;
            serverStats.maxInFlight = Math.max(serverStats.maxInFlight, inFlight);
            setTimeout(() => {
                inFlight--;
                res.writeHead(200, { "content-type": "text/html" });
                res.end(`<h2>slow ${req.url?.split("/").pop() ?? ""}</h2>`);
            }, SLOW_RESPONSE_MS);
            return;
        }
        const page = PAGES[req.url ?? ""];
        if (page) {
            res.writeHead(200, { "content-type": "text/html" });
            res.end(page);
            return;
        }
        res.writeHead(403);
        res.end("Forbidden");
    });
    await new Promise<void>(resolve => { srv.listen(0, "127.0.0.1", resolve); });

    const url = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
    return { server: srv, baseUrl: url, stats: serverStats };
};

let server: http.Server,
    baseUrl: string,
    stats: { maxInFlight: number };

const unhandled: unknown[] = [];
const onUnhandled = (e: unknown) => { unhandled.push(e); };

beforeAll(async () => {
    ({ server, baseUrl, stats } = await startServer());
    process.on("unhandledRejection", onUnhandled);
});

beforeEach(() => {
    stats.maxInFlight = 0;
});

afterAll(async () => {
    process.off("unhandledRejection", onUnhandled);
    await new Promise(resolve => { server.close(resolve); });
});

describe("Crawler", () => {
    it("collects results from chained finds on one page", async () => {
        const c = new Crawler<string>();

        await c.start(`${baseUrl}/`)
            .find("main h3").textContent().result()
            .then(job => job.find("main h2").textContent().result());

        const results = await c.results();
        expect(results).toEqual(["Tank One", "Tank Two", "Heading A", "Heading B"]);
    });

    it("clicks through to subpages", async () => {
        const c = new Crawler<string>();
        await c.start(`${baseUrl}/`).find("main a[target=_self][href^='/package']").click()
            .each(job => job.find("h2,#readme").textContent().result());

        const results = await c.results();
        expect([...results].sort()).toEqual(["first readme", "one", "second readme", "two"]);
    });

    it("clicks through to subpages, collecting shaped results", async () => {
        const c = new Crawler<{ name: string; description: string }>();
        await c.start(`${baseUrl}/`).find("main a[target=_self][href^='/package']").click()
            .each(job => job.find("h2,#readme").textContent().replace((s) => ({
                name: s[0] ?? "",
                description: s[1] ?? "",
            })).result());

        const results = await c.results();
        const sorted = [...results].sort((a, b) => a.name.localeCompare(b.name));
        expect(sorted).toEqual([
            { name: "one", description: "first readme" },
            { name: "two", description: "second readme" },
        ]);
    });
});

describe("concurrency", () => {
    it("throttles concurrent downloads to the default concurrency of 2", async () => {
        const c = new Crawler<string>();
        await c.start(`${baseUrl}/many`).find("a").click()
            .each(job => job.find("h2").textContent().result());

        const results = await c.results();
        expect(results).toHaveLength(6);
        expect(stats.maxInFlight).toBe(2);
    });

    it("throttles concurrent downloads to a custom concurrency", async () => {
        const c = new Crawler<string>({ concurrency: 4 });
        await c.start(`${baseUrl}/many`).find("a").click()
            .each(job => job.find("h2").textContent().result());

        const results = await c.results();
        expect(results).toHaveLength(6);
        expect(stats.maxInFlight).toBe(4);
    });
});

describe("error handling", () => {
    it("rejects the awaited path with the first (http) error, without unhandled rejections", async () => {
        const c = new Crawler<string>();
        // the http error must win over the follow-up "You can run `attr` only on elements results" errors
        await expect(
            c.start(`${baseUrl}/403`).find("a").attr("href").get(),
        ).rejects.toThrow("Forbidden");

        expect(await c.results()).toEqual([]);
        await new Promise(resolve => { setTimeout(resolve, 100); });
        expect(unhandled).toEqual([]);
    });

    it("rejects result() the same way as get()", async () => {
        const c = new Crawler<string>();
        await expect(
            c.start(`${baseUrl}/403`).find("a").attr("href").resolve().result(),
        ).rejects.toThrow("Forbidden");
    });

    it("propagates child job errors through each()", async () => {
        const c = new Crawler<string>();
        await expect(
            c.start(`${baseUrl}/links`).find("a").click()
                .each(job => job.find("h1").textContent().result()),
        ).rejects.toThrow("Forbidden");

        await new Promise(resolve => { setTimeout(resolve, 100); });
        expect(unhandled).toEqual([]);
    });
});
