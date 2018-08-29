const { TumblrImageDownloader } = require('../src');
const { assert } = require('chai');
const _ = require('lodash');

require('dotenv').load();

const tumblr_username = process.env.TUMBLR_USERNAME;
const tumblr_password = process.env.TUMBLR_PASSWORD;
const proxy_url = process.env.PROXY_URL || process.env.HTTP_PROXY;
const user_agent = "Mozilla/5.0 (iPhone; CPU iPhone OS 9_1 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13B143 Safari/601.1";

function DownloaderFactory() {
    return new TumblrImageDownloader(null, user_agent, proxy_url);
}

describe('TumblrDownloader', function () {
    before('check for credentials in env', function () {
        assert.isDefined(tumblr_username, "username is not in the environment");
        assert.isDefined(tumblr_password, "password is not in the environment");
    });
    
    describe('#getLoginForm()', function () {
        let downloader = DownloaderFactory();
        let form;

        it('should retrieve the login form', function () {
            this.timeout(2000);

            return downloader
                .getLoginForm()
                .then(($form) => {
                    form = $form;
                });
        });
        
        it('should contain a form key', function () {
            assert.isDefined(form.form_key);
            assert.isNotNull(form.form_key);
        });

        it('should contain the required fields', function () {
            let test_form = _.cloneDeep(form);
            delete test_form.form_key;
            
            assert.deepEqual(downloader.login_form_template, test_form);
        });
    });


    describe('#postLoginForm()', function () {
        let downloader = DownloaderFactory();
        let form;

        before('request login form', function () {
            this.timeout(2000);
            return downloader.getLoginForm().then(($form) => { form = $form; });
        });

        it('should successfully post the login form', function () {
            this.timeout(2000);
            form['user[email]'] = form['determine_email'] = tumblr_username;
            form['user[password]'] = tumblr_password;
    
            return downloader.postLoginForm(form);
        });

        it('should contain a valid authenticated cookies', function () {
            assert.equal("1", downloader.cookies.store.idx["tumblr.com"]["/"]["logged_in"].value, "login cookie not found or not indicating being logged in");
        });
    });

    describe("#login(email, password)", function () {
        let downloader = DownloaderFactory();

        it('should sucessfully login', function () {
            this.timeout(8000);
            return downloader.login(tumblr_username, tumblr_password);
        });

        it('should contain a valid authenticated cookies', function () {
            assert.equal("1", downloader.cookies.store.idx["tumblr.com"]["/"]["logged_in"].value, "login cookie not found or not indicating being logged in");
        });
    });
});