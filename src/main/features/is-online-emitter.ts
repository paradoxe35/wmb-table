import { EventEmitter } from 'events';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import readline from 'readline';
import isOnline from 'is-online';

type IsOnline = {
  online: boolean;
};

type Callback = (status: IsOnline) => void;

// is online emitter using spawn and ping cmd
const CONNECTIVITY_STATUS = {
  online: false,
};

export default class IsOnlineEmitter {
  private RE_SUCCESS = /bytes from/i; // success reponse of system OS ping
  private INTERVAL = '2'; // ping loop interval
  private IP = '8.8.8.8'; //google ip
  private network: EventEmitter;
  private ping_process: ChildProcessWithoutNullStreams | undefined;
  private readline_i: readline.Interface | undefined;

  private _connectivity_event = 'connectivity.change';

  constructor() {
    this.network = new EventEmitter();
    this.check_connectivity = this.check_connectivity.bind(this);
  }

  private _callback(_value: IsOnline) {}

  // callback function in params
  public connectivity_change(callback: Callback) {
    this._callback = callback;
  }

  // readline from terminal interface to determine if there's connection or not
  private check_connectivity(str: string) {
    if (this.RE_SUCCESS.test(str)) {
      // emit event only when the was no connection
      if (!CONNECTIVITY_STATUS.online) {
        CONNECTIVITY_STATUS.online = true;
        this.network.emit(this._connectivity_event, CONNECTIVITY_STATUS);
      }
      // emit offline event only when the was connection
    } else if (CONNECTIVITY_STATUS.online) {
      CONNECTIVITY_STATUS.online = false;
      this.network.emit(this._connectivity_event, CONNECTIVITY_STATUS);
    }
  }

  private spawn_process() {
    if (process.platform === 'win32') {
      this.ping_process = spawn('ping', ['-t', this.IP]);
    } else {
      this.ping_process = spawn('ping', [
        '-v',
        '-n',
        '-i',
        this.INTERVAL,
        this.IP,
      ]);
    }
  }

  public start() {
    // listeners connectivity
    this.network.on(this._connectivity_event, this._callback);

    // emit the actual status of connectivity
    this.network.emit(this._connectivity_event, CONNECTIVITY_STATUS);

    // create spawn process
    this.spawn_process();

    this.ping_process?.addListener('exit', () => {});

    // readline interface to get terminal std
    this.readline_i = readline.createInterface(
      this.ping_process!.stdout,
      this.ping_process!.stdin
    );

    // readline terminal event listener
    this.readline_i.on('line', this.check_connectivity);
  }

  public stop() {
    // disconnect all connectitivity listener
    this.network.off(this._connectivity_event, this._callback);
    // close readline interface
    this.readline_i?.off('line', this.check_connectivity);
    this.readline_i?.close();
    //  kill spawn process
    this.ping_process?.kill('SIGINT');
  }
}

// is online emitter using is-online module
const CONNECTIVITY_STATUS_2 = {
  online: false,
};

export class CustomIsOnlineEmitter {
  private timer: NodeJS.Timer | undefined;
  private requesting: boolean = false;
  private closed: boolean = false;

  constructor(private INTERVAL: number = 2000) {
    this.check_connectivity = this.check_connectivity.bind(this);
  }

  private _callback(_value: IsOnline) {}

  // callback function in params
  public connectivity_change(callback: Callback) {
    this._callback = callback;
  }

  public get isOnline(): boolean {
    return CONNECTIVITY_STATUS_2.online;
  }

  public get isOnlineFetch() {
    return isOnline;
  }

  private async connectivity() {
    const is_online = await isOnline();
    if (CONNECTIVITY_STATUS_2.online != is_online) {
      CONNECTIVITY_STATUS_2.online = is_online;
      this._callback(CONNECTIVITY_STATUS_2);
    }
  }

  private clearInterval() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private async check_connectivity() {
    if (this.requesting) {
      this.clearInterval();
      return;
    }
    this.requesting = true;

    await this.connectivity();

    this.requesting = false;

    if (!this.timer && !this.closed) {
      this.timer = setInterval(this.check_connectivity, this.INTERVAL);
    }
  }

  public async start() {
    // invoke the callback on the checker start
    const is_online = await isOnline();
    CONNECTIVITY_STATUS_2.online = is_online;
    this._callback(CONNECTIVITY_STATUS_2);
    // start check connectivity interval
    this.timer = setInterval(this.check_connectivity, this.INTERVAL);
  }

  public stop() {
    this.closed = true;
    this.clearInterval();
  }
}
