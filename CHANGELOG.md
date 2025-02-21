All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [UNRELEASED]
(nothing yet)

## [1.1.0+]
### Added
- full TypeScript support that will block you from returning unexpected data types!
- `replace` method, that runs a callback with current result and replaces the result with returned value
### Breaking
- each now returns the instance back
- some internal changes in filter & map, that should not change anything really
- map now detects new type of content and if it's known it sets the internal runtime checks more friendly, so you can run more functions

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
