const httpServer = require('./backup/express-server');
const loggedIn = require('./backup/response-html');

/** @type {Partial<import('./types').ChildProcessMessage<any>>} */
let message = {};

const handler = async () => {
  const server = await httpServer();

  message = {
    type: 'port',
    data: server.port,
  };
  process.send && process.send(message);

  server.app.get('/', (_req, res) => {
    res.send(loggedIn(process.env.WEBSITE_LINK, process.env.APP_NAME));

    if (_req.query.code) {
      message = {
        type: 'code',
        data: _req.query.code.toString(),
      };
    } else {
      message = {
        type: 'code',
        data: null,
      };
    }

    process.send && process.send(message);

    server.server.close();
  });
};
handler();
