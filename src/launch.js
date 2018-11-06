
const path = require('path');
const fs = require('fs');

const Promise = require('bluebird');
const { Provider } = require('nconf');
const winston = require('winston');

const { TumblrImageDownloader } = require('./');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), 'utf8'));

Promise.promisifyAll(fs);

var logs, nconf;

/**
 * The environment variables that can be used to configure the application.
 * @type {string[]}
 * @constant
 * @default
 */
const env_whitelist = [
    "LOG_LEVEL",
    "TUMBLR_USERNAME",
    "TUMBLR_PASSWORD",
    "USERNAME",
    "PASSWORD",
    "PROXY_URL",
    "HTTP_PROXY"
];

/**
 * Converts a configuration property's name from env variable format to application config format
 * `"CONTROL_HOST"` -> `"controlHost"` 
 * @param {string} env - Environment variable
 * @returns {string}
 * @private
 */
function env_to_config(env) {
	let a = env.toLowerCase().split('_');
	i = 1;
	while (i < a.length) {
		a[i] = a[i][0].toUpperCase() + a[i].substr(1);
		i++;
	}
	return a.join('');
 }

/**
 * Creates an {@link TumblrImageDownloader} instance with the application configuration.
 * @param {Provider} nconf - Nconf instance to use.
 * @returns {TumblrImageDownloader}
 * @private
 */
function TIDFactory(nconf) {
    return new TumblrImageDownloader({
        proxy_url: nconf.get('proxy_url')
    });
}

/**
 * Returns the path to a {@link Photo} within a parent directory.
 * @param {string} parentDir - The parent directory the photos are contained in.
 * @param {Photo} photo - The photo to extra data from.
 * @returns {string} - The path of the photo.
 */
function getPhotoPath(parentDir, photo) {
    let ext = photo.photoUrl.split('/').slice(-1)[0].split('.').pop();
    let photoIdWithExt = `${photo.photoId}.${ext}`;
    return path.join(parentDir, photoIdWithExt);
}

/**
 * Downloads a blog saving it to a directory.
 * @param {Provider} nconf - The nconf instance.
 * @param {Logger} logs - The winston logger.
 * @async
 * @returns {Promise<number>} - Returns the exit code.
 */
async function download(argv, nconf, logs) {
    let dir = argv[1];
    let blogSubdomain = argv[0];
    if (!dir || !blogSubdomain) {
        logs.error('No username or directory provided');
        return 1;
    }
    let downloader = TIDFactory(nconf);
    let username = nconf.get('username');
    let password = nconf.get('password');
    let pageNumber = nconf.get('pageNumber');
    let stopAtIndex = nconf.get('stopAtIndex');
    let stopAtPage = nconf.get('stopAtPage');

    return new Promise((resolve, reject) => {
        let p;
        downloader.once('error', (error) => {
            logs.error(`error downloading from blog ${blogSubdomain}: ${error.message}`);
            p.cancel();
            resolve(1);
        });
        
        downloader.on('photo', (async (photo) => {
            let photoPath = getPhotoPath(dir, photo);
            try {
                await fs.writeFileAsync(photoPath, photo.photoBytes);
                logs.verbose(`saved "${photo.photoId}" to "${photoPath}"`);
            } catch (error) {
                logs.error(`error saving photo "${photo.photoId}" to ${photoPath}`);
                resolve(1);
            }
        }));

        downloader.on('pageChange', (page_info) => {
            logs.info(`downloading page "${page_info.pageNumber}" of "${page_info.blogSubdomain}"`);
        });

        p = (async () => {
            try {
                if (!fs.existsSync(dir))
                    await fs.mkdirAsync(dir);
                
                logs.debug(`logging into Tumblr`);

                await downloader.login(username, password);

                logs.info(`login as ${username} success beginning download of blog "${blogSubdomain}"`);

                let skipExistingFilter = (photo) => {
                    let photoPath = getPhotoPath(dir, photo);
                    if (fs.existsSync(photoPath)) {
                        logs.debug(`photo "${photo.photoId}" has already been saved to "${photoPath}". skipping`);
                        return false;
                    }
                    return true;
                };

                await downloader.scrapeBlog({
                    blogSubdomain,
                    stopAtIndex,
                    stopAtPage,
                    downloadPhotos: true,
                    pageNumber,
                    predownloadFilter: (nconf.get('skipExisting') && skipExistingFilter)
                });

                logs.info(`download complete. exiting.`);

                return 0;
            } catch (error) {
                logs.error(`Error downloading from blog ${blogSubdomain}: ${error.message}`);
                return 1;
            }
        })();

        p.then(resolve).catch(reject);
    });
}

/**
 * Main function for the application.
 * @async
 * @returns {Promise} - Returns the exit code.
 */
async function main () {
    var command;

    const yargs = require('yargs')
    .version(pkg.version)
    .usage('Usage: tumblr-image-downloader [command] [arguments]')
    .strict()
    .option('logLevel', {
        alias: 'l',
        describe: 'Sets the verbosity of log output',
        default: 'info'
    })
    .option('quiet', {
        alias: 'q',
        describe: 'Turns logging off',
        default: false
    })
    .option('username', {
        alias: 'u',
        describe: 'Username to login with'
    })
    .option('password', {
        alias: 'p',
        describe: 'Password to login with'
    })
    .option('config', {
        alias: 'f',
        describe: 'A JSON configuration file to read from'
    })
    .option('proxyUrl', {
        alias: 'x',
        describe: 'The url to a proxy that will be used for all requests. SOCKS(4/5), HTTP(S) and PAC accepted.'
    })
    .command([ '$0', 'download [blogSubdomain] [directory]' ], 'Downloads all photos in a Tumblr blog', (yargs) => {
        yargs
            .positional('blogSubdomain', {
                describe: 'Blog to download',
                demand: true
            })
            .positional('directory', {
                describe: 'Directory to download to',
                demand: true
            })
            .option('pageNumber', {
                alias: 'n',
                describe: 'Page number to start downloading from'
            })
            .option('stopAtIndex', {
                alias: 'i',
                describe: 'Stops downloading after this many pages'
            })
            .option('stopAtPageNumber', {
                alias: 'r',
                describe: "Stop downloading when this page number has been reached"
            })
            .option('skipExisting', {
                alias: 'e',
                describe: 'Skip downloading existing photos.',
                default: true
            });
    }, (argv) => { 
        let args = argv._;
        if (args.length > 2)
            args.shift();
        command = download.bind(null, args); 
    })

    nconf = new Provider();

    nconf
        .argv(yargs)
        .env({
            whitelist: env_whitelist.concat(env_whitelist.map(env_to_config)),
            parseValues: true,
            separator: '__',
            transform: (obj) => {
                if (env_whitelist.includes(obj.key)) {
                    if (obj.key.indexOf('_') !== -1) {
                        obj.key = env_to_config(obj.key.toLowerCase().replace('tumblr_', ''));
                    }
                }
                return obj;
            }
        })
        .defaults(require('./default_config'));

    logs = winston.createLogger({
        level: nconf.get('logLevel'),
        format: winston.format.simple(),
        silent: nconf.get('quiet'),
        transports: [
            new winston.transports.Console({ silent: nconf.get('quiet') })
        ]
    });

    if (nconf.get('config'))
        nconf.file({ file: nconf.get('config') });

    let code = await command(nconf, logs);
    if (code)
        process.exit(code);
}

/**
 * This module contains the command-line logic for the application.
 * @module tumblr-image-downloader/launch
 */
module.exports = { 
    main, 
    download
};