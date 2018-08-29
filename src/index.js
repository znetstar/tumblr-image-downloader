'use strict';

const request = require('request');
const cheerio = require('cheerio');
const ProxyAgent = require('proxy-agent');
const _ = require('lodash');

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

class TumblrImageDownloader {
	constructor(cookie_jar, user_agent, proxy_url) {
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
		return new Promise((resolve, reject) => {
			this.request({
				url: `https://www.tumblr.com/login`
			}, (error, res, body) => {
				if (error) return reject(error);

				try {
					let $ = cheerio.load(body);
					let form_key = $('meta[name="tumblr-form-key"]').attr('content');
					
					let form = _.cloneDeep(this.login_form_template);
					form.form_key = form_key;

					resolve(form);
				} catch (error) {
					reject(error);
				}
			});
		});
	}

	async postLoginForm(form) {
		return new Promise((resolve, reject) => {
			this.request({
				url: 'https://www.tumblr.com/login',
				form,
				method: 'POST',
				followAllRedirects: true
			}, (err, res, body) => {
				if (err) return reject(err);
				try {
					let $ = cheerio.load(body);
					let error_box = $('#signup_forms .error');
					if (error_box.length)
						reject(new Error(error_box.text()));
					else {
						resolve();
					}
				} catch (error) {
					reject(error);
				}
			});		
		});
	}

	async login(username, password) {
		return new Promise((resolve, reject) => {
			this.request({
				url: 'https://www.tumblr.com/dashboard',
				followRedirects: true,
				followAllRedirects: true			
			}, (error, res, body) => {
				if (error) return reject(error);
				try {
					let $ = cheerio.load(body);
					if ($('#signup_forms').length) {
						this.getLoginForm()
						.then((form) => {
							return _.extend(form, {
								determine_email: username,
								'user[email]': username,
								'user[password]': password,								
							});
						})
						.then((form) => this.postLoginForm(form))
						.then(() => {
							resolve({});
						})
						.catch(reject);
					} else {
						resolve({
							already_logged_in: true
						});
					}
				} catch (error) {
					reject(error);
				}
			});
		});
	}
}

module.exports = { TumblrImageDownloader };