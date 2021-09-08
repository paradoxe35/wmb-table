const express = require('express');
const app = express();

/**
 * @type {import("http").Server | null}
 */
let lserver = null;

/**
 * @returns {Promise<import('../types').TmpServer>}
 */
module.exports = function httpServer() {
  if (lserver) lserver.close();

  return new Promise((resolve) => {
    lserver = app.listen(0, () => {
      /** @type {import('http').Server} */
      // @ts-ignore
      const server = lserver;

      /** @type {import('net').AddressInfo} */
      // @ts-ignore
      const address = server.address();

      resolve({
        port: address.port,
        server,
        app,
      });
    });
  });
};
