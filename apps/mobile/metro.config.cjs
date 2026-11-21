const { getDefaultConfig } = require('expo/metro-config');
const { previewProxy } = require('./preview-proxy.cjs');

const config = getDefaultConfig(__dirname);
if (process.env.MYCITY_MOBILE_WEB === '1') {
    const previous = config.server.enhanceMiddleware;
    config.server.enhanceMiddleware = (middleware, server) => previewProxy(process.env.MYCITY_API_PROXY, previous ? previous(middleware, server) : middleware);
}
module.exports = config;
