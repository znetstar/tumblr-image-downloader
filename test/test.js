const { TumblrImageDownloader } = require('../src');
const { assert } = require('chai');
const _ = require('lodash');

require('dotenv').load();

const tumblr_username = process.env.TUMBLR_USERNAME;
const tumblr_password = process.env.TUMBLR_PASSWORD;
const proxy_url = process.env.PROXY_URL || process.env.HTTP_PROXY;

function DownloaderFactory() {
    return new TumblrImageDownloader({ proxy_url });
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

    describe('#downloadPhoto(url)', function () {
        let downloader = DownloaderFactory();

        it('should download a sample photo', function () {
            return downloader.downloadPhoto("https://upload.wikimedia.org/wikipedia/commons/e/e3/NewYork_LibertyStatue.jpg")
                .then((image_resp) => {
                    assert.equal("image/jpeg", image_resp.headers['content-type'], 'image not returned');
                });
        });
    });

    describe('#getPhotos(url)', function () {
        let downloader = DownloaderFactory();
        let photos;

        it('should retrieve a list of photos', function () {
            return downloader.getPhotos('carpics', 1)
                .then(($photos) => {
                    photos = $photos;
                    assert.isNotEmpty(photos, 'photos list either empty or null');
                });
        });

        it('should contain objects that have the required fields', function () {
            for (let photo of photos) {
                assert.containsAllKeys(photo, [
                    'author',
                    'photo_id',
                    'photo_url',
                    'tags'
                ], 'photos list does not contain objects with required fields');
            }
        });
    });

    describe('#scrapeBlog(options)', function () {
        let downloader = DownloaderFactory();

        it('should return photos for a single page', function () {
            return downloader.scrapeBlog({
                blogSubdomain: 'carpics',
                stopAtIndex: 1,
                returnPhotos: true
            }).then((photos) => {
                assert.isNotEmpty(photos);

                for (let photo of photos) {
                    assert.containsAllKeys(photo, [
                        'author',
                        'photo_id',
                        'photo_url',
                        'tags'
                    ], 'photos list does not contain objects with required fields');
                }
            });
        });

        it('should return photos for a single page and download the images', function () {
            return downloader.scrapeBlog({
                blogSubdomain: 'carpics',
                stopAtIndex: 1,
                returnPhotos: true,
                downloadPhotos: true
            }).then((photos) => {
                assert.isNotEmpty(photos);

                for (let photo of photos) {
                    assert.containsAllKeys(photo, [
                        'author',
                        'photo_id',
                        'photo_url',
                        'tags',
                        'photo_bytes'
                    ], 'photos list does not contain objects with required fields');
                }
            });
        });
    });
});