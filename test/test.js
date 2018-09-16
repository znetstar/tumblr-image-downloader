const fs = require('fs');
const path = require('path');

const { assert } = require('chai');
const { Provider } = require('nconf');
const winston = require('winston');
const _ = require('lodash');
const del = require('del');
const Promise = require('bluebird');
const { Magic, MAGIC_MIME_TYPE } = require('mmmagic');
const magic = new Magic(MAGIC_MIME_TYPE);

const { TumblrImageDownloader } = require('../src');
const launch = require('../src/launch');

Promise.promisifyAll(fs);
Promise.promisifyAll(magic);
require('dotenv').load();
const username = process.env.username;
const password = process.env.password;
const proxyUrl = process.env.PROXY_URL || process.env.HTTP_PROXY;

function DownloaderFactory() {
    return new TumblrImageDownloader({ proxyUrl });
}

// describe('TumblrDownloader', function () {
//     describe('#getLoginForm()', function () {
//         let downloader = DownloaderFactory();
//         let form;

//         it('should retrieve the login form', async function () {
//             this.timeout(2000);

//             form = await downloader.getLoginForm();
//         });
        
//         it('should contain a form key', function () {
//             assert.isDefined(form.form_key);
//             assert.isNotNull(form.form_key);
//         });

//         it('should contain the required fields', function () {
//             let test_form = _.cloneDeep(form);
//             delete test_form.form_key;
            
//             assert.deepEqual(downloader.login_form_template, test_form);
//         });
//     });


//     describe('#postLoginForm()', function () {
//         let downloader = DownloaderFactory();
//         let form;

//         before('request login form', async function () {
//             this.timeout(2000);
//             form = await downloader.getLoginForm();
//         });

//         it('should successfully post the login form', async function () {
//             this.timeout(2000);
//             form['user[email]'] = form['determine_email'] = username;
//             form['user[password]'] = password;
    
//             await downloader.postLoginForm(form);
//         });

//         it('should contain a valid authenticated cookies', function () {
//             assert.equal("1", downloader.cookies.store.idx["tumblr.com"]["/"]["logged_in"].value, "login cookie not found or not indicating being logged in");
//         });
//     });

//     describe("#login(email, password)", function () {
//         let downloader = DownloaderFactory();

//         it('should sucessfully login', async function () {
//             this.timeout(8000);
//             await downloader.login(username, password);
//         });

//         it('should contain a valid authenticated cookies', function () {
//             assert.equal("1", downloader.cookies.store.idx["tumblr.com"]["/"]["logged_in"].value, "login cookie not found or not indicating being logged in");
//         });
//     });

//     describe('#downloadPhoto(url)', function () {
//         let downloader = DownloaderFactory();

//         it('should download a sample photo', async function () {
//             let image_resp = await downloader.downloadPhoto("https://upload.wikimedia.org/wikipedia/commons/e/e3/NewYork_LibertyStatue.jpg");
//             assert.equal("image/jpeg", image_resp.headers['content-type'], 'image not returned');
//         });
//     });

//     describe('#getPhotos(url)', function () {
//         let downloader = DownloaderFactory();
//         let photos;

//         it('should retrieve a list of photos', async function () {
//             photos = await downloader.getPhotos('carpics', 1);

//             assert.isNotEmpty(photos, 'photos list either empty or null');
//         });

//         it('should contain objects that have the required fields', function () {
//             for (let photo of photos) {
//                 assert.containsAllKeys(photo, [
//                     'author',
//                     'photo_id',
//                     'photo_url',
//                     'tags'
//                 ], 'photos list does not contain objects with required fields');
//             }
//         });
//     });

//     describe('#scrapeBlog(options)', function () {
//         let downloader = DownloaderFactory();

//         it('should return photos for a single page', async function () {
//             this.timeout(25000);

//             let photos = await downloader.scrapeBlog({
//                 blogSubdomain: 'carpics',
//                 stopAtIndex: 1,
//                 returnPhotos: true
//             });

//             assert.isNotEmpty(photos);

//             for (let photo of photos) {
//                 assert.containsAllKeys(photo, [
//                     'author',
//                     'photo_id',
//                     'photo_url',
//                     'tags'
//                 ], 'photos list does not contain objects with required fields');
//             }
//         });

//         it('should return photos for a single page and download the images', async function () {
//             this.timeout(60000);

//             let photos = await downloader.scrapeBlog({
//                 blogSubdomain: 'carpics',
//                 stopAtIndex: 1,
//                 returnPhotos: true,
//                 downloadPhotos: true
//             });

//             assert.isNotEmpty(photos);

//             for (let photo of photos) {
//                 assert.containsAllKeys(photo, [
//                     'author',
//                     'photo_id',
//                     'photo_url',
//                     'tags',
//                     'photo_bytes'
//                 ], 'photos list does not contain objects with required fields');
//             }
//         });
//     });
// });

describe('tumblr-image-downloader [command] [arguments]', function () {
    const { download} = launch;
    let images;
    const nconf_factory = (obj) => (new Provider()).overrides(obj);
    const logs_factory = () => winston.createLogger({ silent: true, transports: [ new (winston.transports.Console)({silent: true}) ] });

    describe('download [blogSubdomain] [directory]', function () {
        this.timeout(25000);
        let tmp_dir;
        before('create temp dir', function () {
            tmp_dir = fs.mkdtempSync("tid-test");
        });

        it('should download all photos from the first page of the "carpics" blog and save it to a temporary path', async function () {
            let nconf = nconf_factory({
                proxyUrl,
                username,
                password,
                stopAtIndex: 1
            });

            let code = await download(['carpics', tmp_dir], nconf, logs_factory());
            assert.equal(0, code, "Exit code was not zero");
        });

        it("the directory should have files", async function () {
            images = await fs.readdirAsync(tmp_dir);
            assert.isAtLeast(images.length, 1);
        });

        it("the directory should contain images", async function () {
            for (let image of images) {
                let mime_type = await magic.detectFileAsync(path.join(tmp_dir, image));
                assert.isTrue(mime_type.indexOf('image/') !== -1);
            }
        });

        after('remove temp dir', async function () { await del(path.join(tmp_dir, "**"), { force: true }); });
    });
});