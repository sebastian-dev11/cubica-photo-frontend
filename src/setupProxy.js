const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = (app) => {
  app.use(
    '/api',
    createProxyMiddleware({
      target: process.env.API_PROXY_TARGET || 'https://cubica-photo-app.onrender.com',
      changeOrigin: true,
      pathRewrite: {
        '^/api': ''
      }
    })
  );
};
