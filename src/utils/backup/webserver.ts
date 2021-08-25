import express from 'express';
const app = express();

let lserver: import('http').Server | null = null;

export type TmpServer = {
  port: number;
  server: import('http').Server;
  app: express.Express;
};

export default function httpServer(): Promise<TmpServer> {
  if (lserver) lserver.close();

  return new Promise((resolve) => {
    lserver = app.listen(0, () => {
      const server = lserver as import('http').Server;
      resolve({
        port: (server.address() as import('net').AddressInfo).port,
        server,
        app,
      } as TmpServer);
    });
  });
}
