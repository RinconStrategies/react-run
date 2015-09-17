var config = require('./');
var fontConfig = require('./fonts');

module.exports = {
    name: 'Gulp Starter Icons',
    src: config.sourceAssets + '/icons/*.svg',
    dest: fontConfig.dest,
    sassDest: config.sourceAssets + '/stylesheets/generated',
    template: './gulpfile.js/tasks/iconFont/template.sass',
    sassOutputName: '_icons.sass',
    fontPath: '../../fonts',
    className: 'icon',
    options: {
        fontName: 'icons',
        appendCodepoints: true,
        appendUnicode: true,
        formats: ['ttf', 'eot'],
        normalize: true
    }
};
