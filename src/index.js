'use strict';

const request = require('request-promise');
const cheerio = require('cheerio');
const ProxyAgent = require('proxy-agent');
const _ = require('lodash');
const EventEmitter = require('eventemitter3');

const TUMBLR_USER_AGENT = "tumblr downloader";

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
	constructor(cookie_jar, user_agent, proxy_url) {
		super();

		let jar = this.jar = request.jar();
		if (cookie_jar)
			this.cookies = cookie_jar;
		let agent = this.agent = proxy_url ? new ProxyAgent(proxy_url) : void(0);
		this.user_agent = user_agent || TUMBLR_USER_AGENT;
		this.request = request.defaults({
			jar,
			agent,
			headers: {
				'User-Agent': this.user_agent
			}
		});

		this.login_form_template = _.cloneDeep(TUMBLR_LOGIN_FORM);
	}

	get cookies() {
		return this.jar._jar;
	}
	
	set cookies(value) {
		this.jar._jar = value;
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
			encoding: null
		});
	}

}

module.exports = { TumblrImageDownloader };