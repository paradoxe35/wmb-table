import express from 'express';

export type TmpServer = {
  port: number;
  server: import('http').Server;
  app: express.Express;
};

export type ChildProcessMessage<T> = {
  type: 'port' | 'code';
  data: T;
};

export type ChildProcessConvertMessage<T> = {
  type: 'converted';
  data: T;
};

export type ConvertMessage = {
  fileName: string;
  title: string;
};
