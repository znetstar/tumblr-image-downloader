# Changelog

## [1.0.0] - 2018-08-29

### Added
- `login` function to sign-in into Tumblr account for all requests.
- `getPhotos` function to retrieve photos for a given blog/page.
- `scrapeBlog` function retrieve all photos for a blog or range of pages in a blog.

### [1.0.1] - 2018-09-06

### Changed
- Bug fixes from inital release
- Moved 'chai' package to devDependencies

### [1.0.2] - 2018-09-06

### Changed
- 'request-promise' is replaced with 'request-promise-any' so that other Promise libraries can be used. By default, the native Promise implementation will be used.