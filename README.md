# Tumblr Image Downloader
This package is a library for downloading images from Tumblr blogs. 

[![NPM](https://nodei.co/npm/tumblr-image-downloader.png)](https://nodei.co/npm/tumblr-image-downloader/)

[![Build Status](https://travis-ci.org/znetstar/tumblr-image-downloader.svg?branch=master)](https://travis-ci.org/znetstar/tumblr-image-downloader)

The library contains a class `TumblrImageDownloader`.

All methods will return promises.

## Configuration

The class constructor takes an object containing options. The following fields are accepted:
* `proxy_url` url to a proxy server that will be used to service each request. Will accept any url [proxy-agent](https://github.com/TooTallNate/node-proxy-agent) will accept.
* `user_agent` the user-agent that will be used to make desktop requests.
* `mobile_user_agent` the user-agent that will be used to make mobile requests.
* `cookie_jar` a [tough-cookie](https://github.com/salesforce/tough-cookie) Cookie Jar that will be used with each request.

## Photos

Each photo object will contain the following fields
* `photo_id` - the unqiue identifier associated with the post.
* `photo_url` - direct url to the photo (not to the post).
* `author` - the original user who posted the image.
* `tags` - an array of tags applied to the post.
* `photo_bytes` - if scrape blogged is called with `downloadPhotos` set to `true` this field will contain a buffer with the downloaded image.

## Methods

### login(username, password)
signs in as the user for all future requests.

a [tough-cookie](https://github.com/salesforce/tough-cookie) cookie jar at `this.cookies` can be used to retrieve/set the authenticated cookies.

### getPhotos(blogSubdomain, pageNumber)
returns a list of photos from a single page of a blog

takes the blog's subdomain (e.g. my-fancy-blog.tumblr.com) and a page number, which defaults to 1.

### scrapeBlog(options) 
iterates through a range of pages in the blog and returns a list of all photos present on those pages.

takes an object with following options
* `blogSubdomain` (required) the blog's subdomain
* `returnPhotos` (default: false) return all photos as an array. Be careful using this option on large blogs as node may run out of memory.
* `downloadPhotos` (default: false) download the photos from tumblr. Be careful using this option with `returnPhotos`
* `pageNumber` (default: 1) page number to begin scraping at
* `stopAtIndex` (default: undefined) index to stop at (e.g. 5 would stop the scrape after scraping 5 pages)
* `stopAtPageNumber` (default: undefined) page number to stop at (e.g. 20 would stop the scrape after pageNumber 20 has been scraped)

## Events

The `photo` event will fire with each photo scraped and `end` will fire when all photos have been scraped.

`error` will fire if an error occurs during scraping.

# Test

Test with `npm test`. Tests are written in mocha.