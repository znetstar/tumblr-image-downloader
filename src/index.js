'use strict';

const request = require('request-promise');
const cheerio = require('cheerio');
const ProxyAgent = require('proxy-agent');
const _ = require('lodash');
const EventEmitter = require('eventemitter3');

const TUMBLR_USER_AGENT =  "Mozilla/5.0 (iPhone; CPU iPhone OS 9_1 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13B143 Safari/601.1";
const TUMBLR_MOBILE_USER_AGENT = TUMBLR_USER_AGENT;

const TUMBLR_LOGIN_FORM = {
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
};
Object.seal(TUMBLR_LOGIN_FORM);

const transform_cheerio = (body) => cheerio.load(body);

class TumblrImageDownloader extends EventEmitter {
	constructor(options) {
		super();

		let cookie_jar = options.cookie_jar;
		let user_agent = options.user_agent;
		let proxy_url = options.proxy_url;
		let mobile_user_agent = options.mobile_user_agent;

		let jar = this.jar = request.jar(cookie_jar);
		
		let agent = this.agent = proxy_url ? new ProxyAgent(proxy_url) : void(0);
		this.user_agent = user_agent || TUMBLR_USER_AGENT;
		this.mobile_user_agent = mobile_user_agent || TUMBLR_MOBILE_USER_AGENT;

		let headers = this.headers = {
			'User-Agent': this.user_agent
		};

		this.request = request.defaults({
			jar,
			agent,
			headers
		});

		this.login_form_template = _.cloneDeep(TUMBLR_LOGIN_FORM);
	}

	get cookies() {
		return this.jar._jar;
	}
	
	set cookies(value) {
		this.jar._jar = value;
	}

	get xhr_headers() {
		return _.extend(_.clone(this.headers), {
			'User-Agent': this.mobile_user_agent,
			'X-Requested-With': 'XMLHttpRequest'
		});
	}

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

			return {};
		} else {
			return {
				already_logged_in: true
			};
		}
	}

	async downloadPhoto(url) {
		return await this.request({
			url,
			encoding: null,
			resolveWithFullResponse: true
		});
	}

	async getPhotoset(url) {
		let $ = await request({
			url,
			headers: this.xhr_headers,
			transform: transform_cheerio
		});

		return $('a.photoset_photo').get().map((photoset_photo) => {
			let photo_id =  $(photoset_photo).attr('id').split('photoset_link_').pop();
			let photo_url = $('img', photoset_photo).attr('src');

			return { photo_id, photo_url };
		});
	}

	async getPhotos(blogSubdomain, pageNumber) {
		let page = pageNumber || 1;
		let $ = await this.request({
			url: `https://${blogSubdomain}.tumblr.com/page/${page}`,
			headers: this.xhr_headers,
			transform: transform_cheerio
		});

		let photos = $('article.photo, article.photoset').get();
		
		let process_photos = photos.map((photo) => {
			let photo_id = $(photo).attr('data-post-id');
			let tags = ($('.tag-link', photo).get()).map(function (element) { return $(element).text(); });
			let author = $('.reblog-link', photo).length ? $('.reblog-link', photo).attr('data-blog-card-username') : blogSubdomain;
			if ($(photo).is('article.photoset')) {
				let photoset_url = `https://${blogSubdomain}.tumblr.com`+$('iframe.photoset', photo).attr('src');
				return this.getPhotoset(photoset_url)
						.then((photoset_photos) => {
							return photoset_photos.map((photo) => {
								return _.extend(photo, { tags, author });
							});
						})
			} else {
				let photo_url = $('img', photo).attr('src');
				return Promise.resolve({ photo_id, tags, author, photo_url });
			}
		});

		let result = await Promise.all(process_photos);
		return _.flatten(result);
	}

	async scrapeBlog(options) {
		if (!options.blogSubdomain)
			throw new Error("Blog subdomain not provided");
		options.pageNumber = options.pageNumber || 1;
		options.index = options.index || 0;
		let { pageNumber, index, blogSubdomain, downloadPhotos, returnPhotos } = options;
		try {
			let photos = await this.getPhotos(blogSubdomain, pageNumber);

			if (downloadPhotos) {
				let process_photos = photos.map((photo_info) => {
					return this.downloadPhoto(photo_info.photo_url)
						.then((photo_resp) => {
							photo_info.photo_bytes = photo_resp.body;
							return photo_info;
						});
				});

				photos = await Promise.all(process_photos);
			}

			photos.forEach((photo) => this.emit('photo', photo));
			if (returnPhotos) {
				options.photos = (options.photos || []).concat(photos);
			}

			if (photos.length) {
				if ((options.stopAtIndex && index >= options.stopAtIndex) || (options.stopAtPage && pageNumber >= options.stopAtPage)) {
					this.emit('end');
					if (returnPhotos)
						return options.photos;
					return;
				}
				options.pageNumber++;
				options.index++;
				this.emit('pageChange', { blogSubdomain, pageNumber, index  })
				return await this.scrapeBlog(options);
			}
			else {
				this.emit('end');
				if (returnPhotos) 
					return options.photos;
			}
		} catch (error) { 
			this.emit('error', error);
			throw error;
		}
	} 
	
}

module.exports = { TumblrImageDownloader };