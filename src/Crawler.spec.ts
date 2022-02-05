import { Crawler } from "./Crawler";

describe("Crawler", function() {
    it("works", async function() {
        // @TODO add nock and some tests that won't change with time
        const c = new Crawler();

        await c.start("https://www.npmjs.com/search?q=tank").find("main h3").textContent().result();

        const results = await c.results();
        console.info(results);
    }, 20_000);
});
