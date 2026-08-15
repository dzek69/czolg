All notable changes to this project will be documented in this file.

The format is based on [EZEZ Changelog](https://ezez.dev/changelog/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [UNRELEASED]
### Added
- `concurrency` option for `Crawler` (defaults to 2, as before)
- `Job.wait()` - resolves when all currently queued steps of the job are done (never rejects)
### Fixed
- crawler-level concurrency now actually throttles page downloads; previously every job started its download immediately and the crawler-wide queue only idled alongside, so any number of pages could be fetched at once
- HTTP/crawl errors no longer escape as unhandled promise rejections (which could kill the host process); the first error in a job's chain is stored and the remaining chained steps are skipped
- `get()` and `result()` now reject with the job's first error instead of resolving with broken data
- `each()` now awaits values returned by the callback, so errors from child jobs (after `.click()`) propagate to the awaited path
### Dev
- specs rewritten from live npmjs.com crawls (npmjs now responds with 403 to the crawler) to a deterministic local HTTP server

## [2.0.0]
### Added
- full TypeScript support that will block you from returning unexpected data types!
- `replace` method, that runs a callback with current result and replaces the result with returned value
### Breaking
- each now returns the instance back
- some internal changes in filter & map, that should not change anything really
- map now detects new type of content and if it's known it sets the internal runtime checks more friendly, so you can run more functions
### Dev
- deps upgrade, docs pipelines added

## [1.1.0] - 2022-10-08
### Added
- support for filtering

## [1.0.0] - 2022-09-17
### Added
- support for passing headers for crawler

## [0.0.2] - 2022-02-05
### Fixed
- esm build

## [0.0.1] - 2022-02-05
### Added
- first version
