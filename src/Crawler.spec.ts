import type { Cheerio } from "cheerio";
import type { Node } from "domhandler"; // eslint-disable-line @typescript-eslint/no-shadow
import type { Elements } from "./Job";

import { Crawler } from "./Crawler.js";

describe("Crawler", function() {
    it("works", async function() {
        // @TODO add nock and some tests that won't change with time
        const c = new Crawler<string>();

        await c.start("https://www.npmjs.com/search?q=tank")
            .find("main h3").textContent().result()
            .then(job => job.find("main h2").textContent().result());

        const results = await c.results();
        console.info(results);
    }, 20_000);

    it("click test", async () => {
        const c = new Crawler<string>();
        await c.start("https://www.npmjs.com/search?q=tank").find("main a[target=_self][href^='/package']").click()
            .each(job => job.find("h2:first,#readme").textContent().result());

        const results = await c.results();
        console.info(results);
    });

    it("click test with shape", async () => {
        const c = new Crawler<{ name: string; description: string }>();
        await c.start("https://www.npmjs.com/search?q=tank").find("main a[target=_self][href^='/package']").click()
            .each(job => job.find("h2:first,#readme").textContent().replace((s) => ({
                name: s[0],
                description: s[1],
            })).result());

        const results = await c.results();
        console.info(results);
    });
});
