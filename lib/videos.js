/*
 * mongo-edu
 *
 * Copyright (c) 2014 Przemyslaw Pluta
 * Licensed under the MIT license.
 * https://github.com/przemyslawpluta/mongo-edu/blob/master/LICENSE
 */

var path = require('path'),
    fs = require('fs'),
    youtubedl = require('youtube-dl'),
    filesize = require('filesize'),
    ProgressBar = require('progress'),
    request = require('request'),
    progress = require('request-progress'),
    colors = require('colors'),
    _ = require('lodash');

var downloadPath = '', ncc = false, handout = false;

var handleList = function handleList(list) {

    var currentList = list,
        opt = (!ncc) ? ['--max-quality=18'] : ['--max-quality=18', '--no-check-certificate'],

    getHandouts = function getHandouts(item) {

        var name = path.basename(item), bar, dounloadFile, dlh, left,

        downloadItem = function downloadItem() {

            dlh = progress(request(item), { throttle: 0 });

            console.log('[' + 'i'.magenta + '] Downloading: ' + name.cyan);

            dlh.on('progress', function(state) {
                if (!bar) {
                    bar = new ProgressBar('[' + '>'.green + '] ' + filesize(state.total) + ' [:bar] :percent :etas', { complete: '=', incomplete: ' ', width: 20, total: 100.0 });
                }
                if (!bar.complete) { bar.tick(parseInt(state.percent, 10)); }
            });

            dlh.on('error', function error(err) {
                return console.log(err.stack);
            });

            dounloadFile = dlh.pipe(fs.createWriteStream(downloadPath + name));

            dounloadFile.on('close', function close() {
                console.log('[' + 'i'.green + '] Done.' + left);
                handleList(currentList);
            });

            dounloadFile.on('error', function error(err) {
                return console.log(err.stack);
            });
        };

        fs.exists(downloadPath + name, function (exists) {
            left = (currentList.length)? ' ' + currentList.length + ' left ...' : '';

            if (exists) {
                console.log('[' + '>'.magenta + '] ' + name + ' has already been downloaded.' + left);
                return handleList(currentList);
            }

            downloadItem();

        });

    },

    getVideos = function getVideos(item) {

        if (handout) { return getHandouts(item); }

        var dl = youtubedl.download(item, downloadPath, opt), bar;

        dl.on('download', function download(data) {
            console.log('[' + 'i'.magenta + '] Downloading: ' + data.filename.cyan + ' > ' + item);
            bar = new ProgressBar('[' + '>'.green + '] ' + data.size + ' [:bar] :percent :etas', { complete: '=', incomplete: ' ', width: 20, total: 100.0 });
        });

        dl.on('progress', function progress(data) {
            if (!bar.complete) { bar.tick(parseInt(data.percent, 10)); }
        });

        dl.on('error', function error(err) {
            return console.log(err.stack);
        });

        dl.on('end', function end(data) {
            var left = (currentList.length)? ' ' + currentList.length + ' left ...' : '';
            if (data.filename) {
                if (data.filename.indexOf('has already been downloaded') !== -1) {
                    console.log('[' + '>'.magenta + '] ' + data.filename + '.' + left);
                } else {
                    console.log('[' + 'i'.green + '] Done in ' + data.timeTakenms + 'ms.' + left);

                }
            } else {
                console.log('[' + 'i'.red + '] Download Issues');
            }
            handleList(currentList);
        });
    };

    if (currentList.length) { return getVideos(currentList.shift()); }
    console.log('[ Finished ]'.green);

};

module.exports = {

    details: function details(opt, argv, callback) {

        downloadPath = argv.d;
        if (argv.ncc) { ncc = true; }
        if (argv.h) { handout = true; }

        var bar = new ProgressBar('[' + '>'.magenta + '] Collecting [:bar] :percent', { complete: '=', incomplete: ' ', width: 20, total: opt.length }),
            options = (!ncc) ? [] : ['--no-check-certificate'];

        var isFinished = function isFinished(count, items) {
            if (count === 0) {

                var sortedList = _.map(_.sortBy(items, 'id'));

                sortedList.unshift({name: 'All', value: 'all', checked: true}, {name: 'Cancel', value: 'cancel'});
                callback(null, sortedList);
            }
        },

        getDetails = function getDetails(item, i) {

            function getInfo() {

                if (handout) {
                    items.push({name: path.basename(item), value: item, id: i});
                    count = count - 1;
                    bar.tick();
                    return isFinished(count, items);
                }

                youtubedl.getInfo(item, options, function(err, info) {

                    items.push((!err)?{name: info.title + ' - ' + info.resolution, value: item, id: i}:{name: 'No info: ' + item, value: item, id: i});

                    count = count - 1;

                    bar.tick();

                    isFinished(count, items);

                });
            }

            setTimeout(function timeout(){ getInfo(); }, 100 * i);

        }, items = [], list = [], i, count;

        list = _.filter(opt, function filter(item) { return (item.indexOf('http://') !== -1) || (item.indexOf('https://') !== -1); });

        if (!list.length) { return callback(null, list); }

        count = list.length;

        for (i = 0; i < list.length; i++) {
            getDetails(list[i], i);
        }
    },

    download: function download(opt, list) {

        var options = opt.videos, fullList = [], selected = [];

        if (options.length === 1 && options[0] === 'cancel') { return console.log('Cancel'); }

        if (options.length === 1 && options[0] === 'all') {
            fullList = _.pull(_.map(list, function map(item) { return item.value; }), 'all', 'cancel');
            return handleList(fullList);
        }

        if (options.length >= 1) {
            selected = _.pull(options, 'all', 'cancel');

            if (selected.length) { return handleList(selected); }
        }

    }
};