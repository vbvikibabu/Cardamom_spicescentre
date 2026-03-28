const path = require('path');

module.exports = {
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  devServer: {
    client: {
      webSocketURL: {
        hostname: 'localhost',
        pathname: '/ws',
        port: 3005,
      },
    },
  },
};