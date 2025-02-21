# Dead simple website crawler

## Objectives and Scope

This is a dead simple crawler created to make data scraping as easy as possible. It's API is and will always somehow
limiting if you plan to clone websites, make an indexer or anything like that.

## Examples

> Get package names from npm search result
```typescript
const c = new Crawler<string>();
await c.start("https://www.npmjs.com/search?q=tank").find("main h3").textContent().result();
const results = await c.results(); // ["tank", "tanker", "tankify", ...]
```
> Get package name + readme content from npm search result
```typescript
const c = new Crawler<string>();
await c.start("https://www.npmjs.com/search?q=tank").find("main a[target=_self][href^='/package']").click()
    .each(job => job.find("h2:first,#readme").textContent().result());
const results = await c.results(); // ["tank", "tank is a package ...", "tanker", "tanker is an awesome ...", ...]
```

> Get package name + readme content from npm search result, wrap in nice object
```typescript
const c = new Crawler<{ name: string; description: string }>();
await c.start("https://www.npmjs.com/search?q=tank").find("main a[target=_self][href^='/package']").click()
    .each(job => job.find("h2:first,#readme").textContent().replace((s) => ({
        name: s[0],
        description: s[1],
    })).result());

const results = await c.results(); // [{ name: "tank", description: "tank is a package ..."}, { name: "tanker", description: "tanker is an awesome ..."}, ...]
```

> Get all images from old reddit page
```typescript
const c = new Crawler<string>();
await c.start("https://old.reddit.com/r/aww/").find("img").attr("src").resolve().result();
const results = await c.results(); // ["https://a.thumbs.redditmedia.com/...", "https://b.thumbs.redditmedia.com/...", ...]
```

## License

MIT
