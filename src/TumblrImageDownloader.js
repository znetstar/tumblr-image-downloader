'use strict';

const request = require('request-promise-any');
const cheerio = require('cheerio');
const ProxyAgent = require('proxy-agent');
const _ = require('lodash');
const { EventEmitter2: EventEmitter } = require('eventemitter2');
const sharp = require("sharp");

/**
 * The default user agent that will be used with all XHR requests.
 * Is a mobile user agent to ensure Tumblr sends a mobile-formatted page.
 *
 * @constant
 * @type {string}
 * @default
 */
const TUMBLR_MOBILE_USER_AGENT = "Mozilla/5.0 (iPhone; CPU iPhone OS 9_1 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13B143 Safari/601.1";

/**
 * The default user agent that will be used with non-XHR requests.
 *
 * @constant
 * @type {string}
 * @default
 */
const TUMBLR_USER_AGENT =  "Mozilla/5.0 (iPhone; CPU iPhone OS 9_1 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13B143 Safari/601.1";

/**
 * The default login form that will be POSTed.
 *
 * @constant
 * @type {object}
 * @default
 */
const TUMBLR_LOGIN_FORM = Object.freeze({
	determine_email: null,
	'user[email]': null,
	'user[password]': null,
	'tumblelog[name]': "",
	'user[age]': "",
	context: "home_signup",
	version: "STANDARD",
	follow: "",
	http_referer: "https://www.tumblr.com/",
	seen_suggestion: "0",
	used_suggestion: "0",
	used_auto_suggestion: "0",
	about_tumblr_slide: "",
	random_username_suggestions: '[""]',
});

/**
 * Transforms an http response into a cheerio object (`$`).
 *
 * @param {string} body - Body of the response.
 * @returns {any} - Cheerio object.
 * @private
 */
function transform_cheerio (body) { return cheerio.load(body); }

/**
 * This class contains methods that can download photos from a Tumblr blog.
 *
 * @extends {EventEmitter}
 */
class TumblrImageDownloader extends EventEmitter {
	/**
	 * Options that can be passed to the constructor
	 * @typedef TumblrImageDownloaderOptions
	 *
	 * @property {CookieJar} [cookie_jar] - A {@link https://bit.ly/2Oq89f0|tough-cookie} compatiable cookie jar. The CookieJar object must be created with `looseMode` set to `true`.
	 * @property {string} [user_agent=TUMBLR_USER_AGENT] -  The user-agent that will be used for desktop requests.
	 * @property {string} [mobile_user_agent=TUMBLR_MOBILE_USER_AGENT] -  The user-agent that will be used for mobile requests.
	 * @property {string} [proxy_url] - URL to a proxy (SOCKS,HTTP or Pac) that will be used with each request. Will be passed to {@link https://bit.ly/2Qz8vSj|proxy-agent}
	 */

	 /**
	  * Creates a `TumblrImageDownloader` object.
	  * @param {TumblrImageDownloaderOptions} options - Options that can be passed to the constructor. All are optional.
	  */
	constructor(options) {
		super({
      wildcard: true,
      delimiter: options.delimiter || ':'
    });

		this.delimiter = options.delimiter || ':';

		let { cookie_jar, user_agent, proxy_url, mobile_user_agent } = options;

		/**
		 * The request `jar` object that will be used with each request.
		 * Is a wrapper for {@link TumblrImageDownloader#cookies} so that `TumblrImageDownloader.cookies == TumblrImageDownloader.jar._jar`.
		 * @type {RequestJar}
		 * @public
		 */
		this.jar = request.jar(cookie_jar);

		/**
		 * The agent that will be used with each request.
		 * @public
		 */
		this.agent = proxy_url ? new ProxyAgent(proxy_url) : void(0);

		/**
		 * The user-agent that will be used with each desktop request.
		 * @public
		 * @type {string}
		 * @default TUMBLR_USER_AGENT;
		 */
		this.user_agent = user_agent || TUMBLR_USER_AGENT;

		/**
		 * The user-agent that will be used with XHR requests.
		 * @public
		 * @type {string}
		 * @default TUMBLR_MOBILE_USER_AGENT;
		 */
		this.mobile_user_agent = mobile_user_agent || TUMBLR_MOBILE_USER_AGENT;

		/**
		 * The headers that will be sent with all non-xhr requests.
		 * @public
		 * @type {Object}
		 */
		this.headers = {
			'User-Agent': this.user_agent
		};

		/**
		 * {@link https://bit.ly/2guFWYe|request-promise-any} object that will be used for each request.
		 * @public
		 * @type {Object}
		 */
		this.request = request.defaults({
			jar: this.jar,
			agent: this.agent,
			headers: this.headers
		});

		/**
		 * The login form that will be posted when {@link TumblrImageDownloader#login} is called, excluding the credentials and CSRF.
		 * @public
		 * @type {Object}
		 */
		this.login_form_template = _.cloneDeep(TUMBLR_LOGIN_FORM);
	}

    /**
     * The cookies that will be sent with each request.
     *
	 * @param {CookieJar} value- A {@link https://bit.ly/2Oq89f0|tough-cookie} compatible `CookieJar` object.
     * @returns {CookieJar} - A {@link https://bit.ly/2Oq89f0|tough-cookie} compatible `CookieJar` object.
     */
	get cookies() {
		return this.jar._jar;
	}

	set cookies(value) {
		this.jar._jar = value;
	}

    /**
     * Returns the headers that will be used during XHR requests.
     *
     * @returns {Object} - Object containing headers
     * @private
     */
	get xhr_headers() {
		return _.extend(_.clone(this.headers), {
			'User-Agent': this.mobile_user_agent,
			'X-Requested-With': 'XMLHttpRequest'
		});
	}

    /**
     * Retrieves the login form from the Tumblr login page and extracts the CSRF token.
     * Returns the {@link TumblrImageDownloader#login_form_template} object with the CSRF token set to `form_key`.
     *
     * @returns {Promise<Object>} - The Tumblr login form.
     * @async
     */
	async getLoginForm() {
		let $ = await this.request({
			url: `https://www.tumblr.com/login`,
			transform: transform_cheerio
		});

		let form_key = $('meta[name="tumblr-form-key"]').attr('content');

		let form = _.cloneDeep(this.login_form_template);
		form.form_key = form_key;

		return form;
	}

    /**
     * Posts the login form.
     *
     * @param {Object} - The Tumblr login form.
     * @async
     */
	async postLoginForm(form) {
		let $ = await this.request({
			url: 'https://www.tumblr.com/login',
			form,
			method: 'POST',
			followAllRedirects: true,
			transform: transform_cheerio
		});

		let error_box = $('#signup_forms .error');

		if (error_box.length)
			throw new Error(error_box.text());;
	}

    /**
     * @typedef {Object} TumblrLoginResponse
     * @property {boolean} [already_logged_in] - Indicates if a session already exists for this account.
     */

    /**
     * Login to the Tumblr account using the provided credentials.
     *
     * @param {string} - The username to use.
     * @param {string} - The password to use.
     * @returns {Promise<TumblrLoginResponse>}
     * @async
     */
	async login(username, password) {
		let $ = await this.request({
			url: 'https://www.tumblr.com/dashboard',
			followRedirects: true,
			followAllRedirects: true,
			transform: transform_cheerio
		});

		if ($('#signup_forms').length) {
			let form = await this.getLoginForm();
			_.extend(form, {
				determine_email: username,
				'user[email]': username,
				'user[password]': password,
			});

			await this.postLoginForm(form);
      await this.getApiToken();
			return { already_logged_in: false };
		} else {
      await this.ensureApiToken();
			return {
				already_logged_in: true
			};
		}
	}

    /**
     * Downloads an individual photo from a Tumblr blog.
     * @param {string} url - URL of the photo to download.
     * @returns {Promise<ClientResponse>} - HTTP Response.
     * @async
     */
	async downloadPhoto(url, fileType = 'png') {
		const promises = [];

		const sharpStream = sharp({
			failOnError: false
		});

		promises.push(
			sharpStream
				.clone()
				[fileType]()
				.toBuffer()
		);

		let res;

		let req = this.request({
			url,
			encoding: null,
			resolveWithFullResponse: true
		});

		let [ resp, body ] = await Promise.all([
			(async () => {
				return new Promise((resolve, reject) => {
					req.once('response', (resp) => resolve(resp));
					req.once('error', (resp) => reject(resp));
					req.pipe(sharpStream);
				});
			})(),
			promises[0]
		])

		resp.body = body;

		return resp;
	}


	async getApiState() {
    let $ = await request({
      url: 'https://www.tumblr.com',
      headers: this.headers,
      transform: transform_cheerio
    });

    let state = $('script:contains("___INITIAL_STATE___")').first();
    state = (state && state.html().replace('window[\'___INITIAL_STATE___\'] = ', '').replace('};', '}'));
    this.apiState = state = JSON.parse(state);

    let token = require('lodash').get(state, 'apiFetchStore.API_TOKEN');

    this.headers.Authorization = `Bearer ${token}`;

    return this.apiState;
  }

    /**
     * Photo in a photoset.
     *
     * @typedef {Object} PhotosetPhoto
     * @property {string} photoId - ID of the photo
     * @property {string} photoUrl - URL of the photo
     */

     /**
      * Returns the photos in a photoset.
      *
      * @param {string} url - URL of the photoset.
      * @returns {Promise<PhotosetPhoto[]>} - The photos in the photoset.
      * @async
      */
	async getPhotoset(url) {
		let $ = await request({
			url,
			headers: this.xhr_headers,
			transform: transform_cheerio
		});

		return $('a.photoset_photo').get().map((photoset_photo) => {
			let photoId =  $(photoset_photo).attr('id').split('photoset_link_').pop();
			let photoUrl = $('img', photoset_photo).attr('src');

			return { photoId, photoUrl };
		});
    }


    get defaultApiUrlQ() {
	    return {
        fields: {
          blogs: 'name,avatar,title,url,is_adult,?is_member,description_npf,uuid,can_be_followed,?followed,?advertiser_name,theme,?primary,?is_paywall_on,?paywall_access,?subscription_plan,share_likes,share_following,can_subscribe,subscribed,ask,?can_submit,?is_blocked_from_primary,?is_blogless_advertiser,?tweet,?admin,can_message,?analytics_url,?top_tags'
        },
        npf: 'true',
        reblog_info: 'true',
        include_pinned_posts: 'true'
      };
    }

    async ensureApiToken() {
	    if (!this.headers.Authorization) {
	      await this.getApiState();
      }
    }

    mkApiUrl(blog) {
	    return `https://www.tumblr.com/api/v2/blog/${blog}/posts`
    }
    /**
     * Represents data on a individual photo.
     *
     * @typedef {Object} Photo
     * @property {string} photoId - Unique ID of the photo.
     * @property {string} photoUrl - URL of the photo.
     * @property {string[]} tags - Tags that belong to the photo.
     * @property {string} author - Original author of the photo.
     * @property {Buffer} [photoBytes] - The actual downloaded photo.
     */

    /**
     * Retrieves all photos on a page of a blog.
     * @param {string} blogSubdomain - Subdomain of the blog.
     * @param {number} [pageNumber=1] - Page number of the blog.
     * @returns {Promise<Photo[]>}
     * @async
     */
  /**
   * Represents data on a individual photo.
   *
   * @typedef {Object} Photo
   * @property {string} photoId - Unique ID of the photo.
   * @property {string} photoUrl - URL of the photo.
   * @property {string[]} tags - Tags that belong to the photo.
   * @property {string} author - Original author of the photo.
   * @property {Buffer} [photoBytes] - The actual downloaded photo.
   */

  /**
   * Retrieves all photos on a page of a blog.
   * @param {string} blogSubdomain - Subdomain of the blog.
   * @param {number} [pageNumber=1] - Page number of the blog.
   * @returns {Promise<Photo[]>}
   * @async
   */
  async getPhotos(blogSubdomain, pageNumber, last) {
    let results = [];
    for await ( let photo of this.getPhotosIterator(blogSubdomain, pageNumber, false)) {
      results.push(photo);
    }

    return results;
  }

  static normalizeKeys(obj) {
    for (let k in obj) {
      obj[k.replace(/_([a-z])/g, function (g) { return g[1].toUpperCase(); })] = obj[k];
    }

    return obj;
  }

  ensureImage(arr) {

  }

  static getContent(post) {
    let content = (_.get(post, 'content') || []);

    if (_.get(post, 'trail.length')) {
        for (let block of post.trail) {
          content = content.concat(block.content);
        }
    }

    let usedKeys = new Set();
    let results = [];
    for (let c of content) {
      if (c.type === 'image' || (
        c.type === 'video' &&
        (c.poster && c.poster.length)
      )) {
        let mediaKey = _.get(c, 'media.0.media_key');
        if (mediaKey && usedKeys.has( mediaKey )) {
          continue;
        }

        usedKeys.add(mediaKey);

        results.push(c);
      }

    }
    return results;
  }


  scopedEmit(scope, event, ...args) {
    this.emit(`${event}${this.delimiter}${scope}`, ...args);
    this.emit(`${event}`, ...args);
  }

  scopedEmitAsync(scope, event, ...args) {
    return Promise.all([
      this.emitAsync(`${event}${this.delimiter}${scope}`, ...args),
      this.emitAsync(`${event}`, ...args)
    ]);
  }

	async* getPhotosIterator(blogSubdomain, pageNumber, autoNext = false) {
	  await this.ensureApiToken();
	  let url, body, posts, post, result, nextPage, posters;

	  let load = async (page = pageNumber) => {
      url = this.mkApiUrl(blogSubdomain);
      body = await this.request({
        url,
        qs: { ...this.defaultApiUrlQ, ...(page || {}) },
        headers: this.headers,
        transform: (b) => JSON.parse(b)
      });


      if (_.get(body, 'response._links.next')) {
        TumblrImageDownloader.normalizeKeys(_.get(body, 'response._links.next'));
      }
      if (_.get(body, 'response._links.next.queryParams')) {
        TumblrImageDownloader.normalizeKeys(_.get(body, 'response._links.next.queryParams'));
      }
      nextPage = {
        page_number: _.get(body, 'response._links.next.queryParams.pageNumber'),
        offset: _.get(body, 'response._links.next.queryParams.offset'),
      }
      posts = (_.get(body, 'response.posts') || []);


      result = [];
    }

    await load();

		while (post = posts.shift()) {
		  TumblrImageDownloader.normalizeKeys(post);
		  let photos = TumblrImageDownloader.getContent(post);
		  if ([ post.objectType, post.originalType ].includes('photo') || photos.length || post.rebloggedFromId) {
		    if (!photos.length && post.rebloggedRootId) {
		      try {
            let realPost = await this.request({
              url: `https://www.tumblr.com/api/v2/blog/${post.rebloggedRootName}/posts/${post.rebloggedRootId}/permalink`,
              qs: {
                'fields[blogs]': 'name,avatar,title,url,is_adult,?is_member,description_npf,uuid,can_be_followed,?followed,?advertiser_name,theme,?primary,?is_paywall_on,?paywall_access,?subscription_plan',
                reblog_info: 'true'
              },
              transform: (b) => JSON.parse(b)
            });

            post = _.get(realPost, 'response.timeline.elements.0');
            TumblrImageDownloader.normalizeKeys(post);
            photos = TumblrImageDownloader.getContent(post);
          } catch (err) {
            this.handleError(err, blogSubdomain);
            continue;
          }
        }

		    if (!photos.length) continue;

		    let postId = post.idString;
		    let tags = post.tags;
		    let author = post.rebloggedRootName || post.blogName;

		    posters = photos.filter(f => f.type === 'video');
		    photos = photos.filter(f => f.type === 'image')

		    let photo;
		    let poster;

		    while (poster = posters.shift()) {
		      try {
            TumblrImageDownloader.normalizeKeys(poster);

            if (!poster.poster) {
              continue
            }

            let urls = poster.poster.sort((a, b) => Number(b.width) - Number(a.width)).map(u => u.url);
            let photoUrl = urls[0];

            let photoObj = {photoId: postId, photoUrl, tags, author, nextPage};
            result.push(photoObj);
            yield photoObj;
          } catch (err) {
		        this.handleError(err, blogSubdomain);
          }
        }

		    for (let i = 0; i < photos.length; i++) {
		      try {
            let photo = photos[i];
            TumblrImageDownloader.normalizeKeys(photo);
            let photoId = photos.length > 1 ? postId + '_' + (i+1) : postId;

            let urls = photo.media.sort((a,b) => Number(b.width) - Number(a.width)).map(u => u.url);
            let photoUrl = urls[0];

            let photoObj = { photoId, photoUrl, tags, author, nextPage };
            result.push(photoObj);
            yield photoObj;
          } catch (err) {
            this.handleError(err, blogSubdomain);
          }
        }
        if (!posts.length && autoNext && nextPage) {
          let signal = await this.scopedEmitAsync(blogSubdomain, 'pageChange', { blogSubdomain, pageNumber: nextPage, result });
          if ([].concat(signal || []).includes(false)) {
            return;
          }

          await load(nextPage);
        }
      }
    }
	}

	handleError(error, scope) {
    if (!this.hasListeners('error'))
      throw error;
    else {
      /**
       * Fires if an error occurs during scraping.
       * @event TumblrImageDownloader#error
       * @type {Error}
       *
       */
      if (!scope) this.emit('error', error);
      else this.scopedEmit(scope, 'error', error);
    }
  }

    /**
     * Options that can be used with {@link TumblrImageDownloader#scrapeBlog}.
     * @typedef ScrapeBlogOptions
     * @property {number} [pageNumber] - Page number to start at.
     * @property {string} blogSubdomain - Subdomain of the blog to scrape from.
     * @property {boolean} [downloadPhotos=false] - Download the photos rather than just grabbing the URLs.
     * @property {boolean} [returnPhotos=false] - Returns all of the photos as an array.
	 * @property {number} [stopAtIndex] - Stop after scraping this many pages.
	 * @property {number} [stopAtPage] - Stop when this page in the blog is reached.
	 * @property {Function} [predownloadFilter] - A function that will be used to filter {@link Photo|Photos} before downloading them.
	 * @orioerty {string} [lastId] - Last photo id to start from
     */

    /**
     * Iterates through all pages in a blog.
     * By default photos are emitted via the {@link TumblrImageDownloader#photo} event and not resolved with the Promise.
     * Set `optioons.returnPhotos` to `true` to return photos.
     *
     * @example
     * let downloader = new TumblrImageDownloader();
     * downlaoder.on('photo', () => { 'do something with photo' });
     * downloader.scrapeBlog({ blogSubdomain: 'blah' });
     *
     * @param {ScrapeBlogOptions} options - Options that can be used with this method.
     * @returns {Promise|Promise<Photo[]>}
     * @async
     */
	async scrapeBlog(options) {
      if (!options.blogSubdomain)
        throw new Error("Blog subdomain not provided");

      let processPhoto = async (photo_info) => {
        let photo_resp = await this.downloadPhoto(photo_info.photoUrl)
        photo_info.photoBytes = photo_resp.body;
        return photo_info;
      };

      let { pageNumber, blogSubdomain, downloadPhotos, returnPhotos } = options;
      try {
        for await (let photo of this.getPhotosIterator(blogSubdomain, pageNumber, true)) {
           if (options.downloadPhotos)
             await processPhoto(photo);

            await this.scopedEmitAsync(blogSubdomain, 'photo', photo);
        }

        this.scopedEmit(blogSubdomain, 'end', { blogSubdomain, pageNumber });
      } catch (error) {
        this.handleError(error, options.blogSubdomain);
      }
	}
}

/**
 * Module that contains the {@link TumblrImageDownloader} class.
 * @module tumblr-image-downloader/TumblrImageDownloader
 * @see TumblrImageDownloader
 */
module.exports = TumblrImageDownloader;
