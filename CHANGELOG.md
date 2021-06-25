# Changelog

## [2.3.0] - 2021-06-19
### Added
- All events from the `TumblrDownloader` (like `photo`) are fired scoped to the blog name, and the global event. So a photo found on blog `foobar` would fire `TumblrImageDownloader.on('photo', myphoto)` and `TumblrImageDownloader.on('photo:foobar', myphoto)` 
## [2.4.0] - 2021-06-24
### Added
- An event is emitted `progress` that reports on the progress of scraping through the blog.

## [2.2.0] - 2021-06-18
### Added
- Extracts content from the `trail` array as well (for deactivated reblogs).

## [2.1.1] - 2021-06-18
### Changed
- Updates sharp

## [2.1.0] - 2021-06-18
### Changed
- Adds support for Tumblr blogs only accessible via "tumblr.com/blogs/..."
- EventEmitter was switched to `eventemitter2`
- If the `error` event handler is listened to `TumblrImageDownloader` will not throw most errors.
### Added 
- `getPhotos` can now be called as an ES6 iterator via `getPhotosIterator`

## [1.0.8] - 2018-11-06
### Changed
- Fixes bug in skipping existing images.

## [1.0.4] - 2018-09-12
### Changed 
- Changed license to CC0

### [1.0.2] - 2018-09-06

### Changed
- 'request-promise' is replaced with 'request-promise-any' so that other Promise libraries can be used. By default, the native Promise implementation will be used.

### [1.0.1] - 2018-09-06

### Changed
- Bug fixes from inital release
- Moved 'chai' package to devDependencies

## [1.0.0] - 2018-08-29

### Added
- `login` function to sign-in into Tumblr account for all requests.
- `getPhotos` function to retrieve photos for a given blog/page.
- `scrapeBlog` function retrieve all photos for a blog or range of pages in a blog.
