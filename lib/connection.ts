/* eslint-disable max-lines-per-function */
/* eslint-disable max-statements */
/* eslint-disable max-lines */
import { EventEmitter } from "events";
import { Socket } from "net";
import { exec } from "xregexp";
import fs from "fs";
import { inspect } from "util";
import tls from "tls";
import zlib from "zlib";
import {
  RETVAL,
  REX_TIMEVAL,
  RE_PASV,
  RE_WD,
  RE_SYST,
  RE_EOL,
  bytesNOOP,
} from "./constants";
import { Parser } from "./parser";
import { FTPError, getFTPError } from "./utils";
import { FTPOptions, defaultOptions } from "./options";

type CMD =
  | "USER"
  | "PASS"
  | "TYPE"
  | "AUTH TLS"
  | "AUTH SSL"
  | "PBSZ"
  | "PROT"
  | "FEAT";

type FTPCallback = (
  err: FTPError | undefined,
  text?: string,
  code?: number
) => void;

class FTP {
  public options: FTPOptions = defaultOptions;

  public connected = false;

  private socket?: Socket = undefined;

  private emitter: EventEmitter;

  private pasvSock?: Socket;

  private feat?: string[] = undefined;

  private currentRequest?: {
    cmd: string;
    callback: FTPCallback;
  } = undefined;

  private queue: any[] = [];

  private securityState?: "upgraded-tls" | "upgraded-ssl";

  private debug?: (message: string) => void | undefined;

  private socketTimeout?: NodeJS.Timeout = undefined;

  private ending?: boolean;

  private parser?: Parser = undefined;

  constructor(options: Partial<FTPOptions> = {}) {
    this.init();

    const { debug, emitter, socket } = this;
    let hasReset = false;

    const noopRequest = {
      cmd: "NOOP",
      callback: (): void => {
        if (this.socketTimeout) clearTimeout(this.socketTimeout);
        this.socketTimeout = setTimeout(donoop, this.options.aliveTimeout);
      },
    };

    const donoop = (): void => {
      if (!socket || (!socket.writable && this.socketTimeout))
        clearTimeout(this.socketTimeout);
      else if (!this.currentRequest && this.queue.length === 0) {
        this.currentRequest = noopRequest;
        if (debug) debug("[connection] > NOOP");
        this.socket.write(bytesNOOP);
      } else noopRequest.callback();
    };

    this.parser = new Parser({ debug });
    this.parser.on("response", (code: number, text: string) => {
      // eslint-disable-next-line no-bitwise
      const retval = (code / 100) >> 0;

      if (retval === RETVAL.ERR_TEMP || retval === RETVAL.ERR_PERM)
        if (this.currentRequest)
          this.currentRequest.callback(
            getFTPError(code, text),
            undefined,
            code
          );
        else emitter.emit("error", getFTPError(code, text));
      else if (this.currentRequest)
        this.currentRequest.callback(undefined, text, code);

      /*
       * a hack to signal we're waiting for a PASV data connection to complete
       * first before executing any more queued requests ...
       *
       * also: don't forget our current request if we're expecting another
       * terminating response ....
       */
      if (this.currentRequest && retval !== RETVAL.PRELIM) {
        this.currentRequest = undefined;
        this.send();
      }

      noopRequest.callback();
    });

    if (this.options.secure) {
      this.options.secureOptions = {
        host: options.host,
        ...(this.options.secureOptions || {}),
        socket,
      };

      // eslint-disable-next-line max-lines-per-function
      const onconnect = (): void => {
        clearTimeout(timer);
        clearTimeout(this.socketTimeout);
        this.connected = true;
        // re-assign for implicit secure connections
        this.socket = socket;

        let cmd: CMD;
        // eslint-disable-next-line complexity
        const reentry = (
          err: FTPError | undefined,
          text: string,
          code: number
        ): void => {
          if (
            err &&
            (!cmd || cmd === "USER" || cmd === "PASS" || cmd === "TYPE")
          ) {
            emitter.emit("error", err);
            if (this.socket) this.socket.end();

            return;
          } else if (
            (cmd === "AUTH TLS" &&
              code !== 234 &&
              this.options.secure !== true) ||
            (cmd === "AUTH SSL" && code !== 334) ||
            (cmd === "PBSZ" && code !== 200) ||
            (cmd === "PROT" && code !== 200)
          ) {
            emitter.emit(
              "error",
              getFTPError(code, "Unable to secure connection(s)")
            );

            if (this.socket) this.socket.end();

            return;
          } else if (!cmd) {
            /*
             * sometimes the initial greeting can contain useful information
             * about authorized use, other limits, etc.
             */
            emitter.emit("greeting", text);

            if (this.options.secure && this.options.secure !== "implicit") {
              cmd = "AUTH TLS";
              this.send(cmd, reentry, true);
            } else {
              cmd = "USER";
              this.send(`USER ${this.options.user}`, reentry, true);
            }
          } else if (cmd === "USER")
            if (code !== 230) {
              // password required
              if (!this.options.password) {
                emitter.emit("error", getFTPError(code, "Password required"));
                if (this.socket) this.socket.end();

                return;
              }
              cmd = "PASS";
              this.send(`PASS ${this.options.password}`, reentry, true);
            } else {
              // no password required
              cmd = "PASS";
              reentry(undefined, text, code);
            }
          else if (cmd === "PASS") {
            cmd = "FEAT";
            this.send(cmd, reentry, true);
          } else if (cmd === "FEAT") {
            if (!err) this.feat = Parser.parseFeat(text);
            cmd = "TYPE";
            this.send("TYPE I", reentry, true);
          } else if (cmd === "TYPE") emitter.emit("ready");
          else if (cmd === "PBSZ") {
            cmd = "PROT";
            this.send("PROT P", reentry, true);
          } else if (cmd === "PROT") {
            cmd = "USER";
            this.send(`USER ${this.options.user}`, reentry, true);
          } else if (cmd.substr(0, 4) === "AUTH") {
            if (cmd === "AUTH TLS" && code !== 234) {
              cmd = "AUTH SSL";
              return this.send(cmd, reentry, true);
            } else if (cmd === "AUTH TLS") this.securityState = "upgraded-tls";
            else if (cmd === "AUTH SSL") this.securityState = "upgraded-ssl";
            socket.removeAllListeners("data");
            socket.removeAllListeners("error");
            socket._decoder = null;
            this.currentRequest = null; // prevent queue from being processed during TLS/SSL negotiation
            this.options.secureOptions.socket = this.socket;
            this.options.secureOptions.session = undefined;
            socket = tls.connect(this.options.secureOptions, onconnect);
            socket.setEncoding("binary");
            socket.on("data", ondata);
            socket.once("end", onend);
            socket.on("error", onerror);
          }
        };

        if (this.securityState)
          if (
            this.securityState === "upgraded-tls" &&
            this.options.secure === true
          ) {
            cmd = "PBSZ";
            this.send("PBSZ 0", reentry, true);
          } else {
            cmd = "USER";
            this.send(`USER ${this.options.user}`, reentry, true);
          }
        else
          this.currentRequest = {
            cmd: "",
            callback: reentry,
          };
      };

      if (this.options.secure === "implicit")
        this.socket = tls.connect(this.options.secureOptions, onconnect);
      else {
        socket.once("connect", onconnect);
        this.socket = socket;
      }

      const ondata = (chunk): void => {
        if (debug) debug(`[connection] < ${inspect(chunk.toString("binary"))}`);
        if (this.parser) this.parser.write(chunk);
      };

      const onerror = (err: string): void => {
        clearTimeout(timer);
        clearTimeout(this.socketTimeout);
        emitter.emit("error", err);
      };

      const ondone = (): void => {
        if (!hasReset) {
          hasReset = true;
          clearTimeout(timer);
          this.reset();
        }
      };

      const onend = (): void => {
        ondone();
        emitter.emit("end");
      };

      socket.on("data", ondata);
      socket.on("error", onerror);

      socket.once("end", onend);

      socket.once("close", (hasErr) => {
        ondone();
        emitter.emit("close", hasErr);
      });

      let timer = setTimeout(() => {
        emitter.emit("error", new Error("Timeout while connecting to server"));
        if (this.socket) this.socket.destroy();
        this.reset();
      }, this.options.connTimeout);

      this.socket.connect(this.options.port, this.options.host);
    }
  }

  private init(options: Partial<FTPOptions> = {}): void {
    // set socket
    let socket = new Socket();

    socket.setTimeout(0);
    socket.setKeepAlive(true);

    this.socket = socket;

    // set emmiter
    this.emitter = new EventEmitter();

    // set options
    this.options = {
      ...defaultOptions,
      ...options,
    };
    if (typeof options.debug === "function") this.debug = options.debug;
  }

  public end(): void {
    if (this.queue.length) this.ending = true;
    else this.reset();
  }

  public destroy(): void {
    this.reset();
  }

  /** 重置 FTP */
  private reset(): void {
    if (this.pasvSock && this.pasvSock.writable) this.pasvSock.end();
    if (this.socket && this.socket.writable) this.socket.end();
    this.socket = undefined;
    this.pasvSock = undefined;
    this.feat = undefined;
    this.currentRequest = undefined;
    this.securityState = undefined;
    if (this.socketTimeout) clearTimeout(this.socketTimeout);
    this.socketTimeout = undefined;
    this.queue = [];
    this.ending = false;
    this.parser = undefined;
    this.options = defaultOptions;
    this.connected = false;
  }

  ascii(callback: FTPCallback): void {
    return this.send("TYPE A", callback);
  }

  binary(callback: FTPCallback): void {
    return this.send("TYPE I", callback);
  }

  abort(immediate: boolean, callback: FTPCallback) {
    if (immediate) this.send("ABOR", callback, true);
    else this.send("ABOR", callback);
  }

  cwd(path: string, callback: FTPCallback, promote: boolean): void {
    this.send(
      `CWD ${path}`,
      (err, text) => {
        if (err) return callback(err);
        const m = RE_WD.exec(text);
        callback(undefined, m ? m[1] : undefined);
      },
      promote
    );
  }

  delete(path: string, cb: () => void): void {
    this.send(`DELE ${path}`, cb);
  }

  site(cmd: string, callback: FTPCallback): void {
    this.send(`SITE ${cmd}`, callback);
  }

  status(callback: FTPCallback): void {
    this.send("STAT", callback);
  }

  rename(from: string, to: string, cb: (err?: FTPError) => void): void {
    this.send(`RNFR ${from}`, (err?: FTPError) => {
      if (err) return cb(err);

      this.send(`RNTO ${to}`, cb, true);
    });
  }

  logout(callback: FTPCallback): void {
    this.send("QUIT", callback);
  }

  listSafe(path, zcomp, cb?: FTPCallback) {
    if (typeof path === "string") {
      // store current path
      this.pwd((err: string | undefined, origpath) => {
        if (err) return cb(err);
        // change to destination path
        this.cwd(path, (err) => {
          if (err) return cb(err);
          // get dir listing
          this.list(zcomp || false, function (err, list) {
            // change back to original path
            if (err) return this.cwd(origpath, cb);
            this.cwd(origpath, function (err) {
              if (err) return cb(err);
              cb(err, list);
            });
          });
        });
      });
    } else this.list(path, zcomp, cb);
  }

  send(cmd?: string | undefined, cb?: FTPCallback, promote?: boolean): void {
    clearTimeout(this.socketTimeout);
    if (cmd !== undefined)
      if (promote) this.queue.unshift({ cmd, cb });
      else this.queue.push({ cmd, cb });

    const queueLen = this.queue.length;
    if (
      !this.currentRequest &&
      queueLen &&
      this.socket &&
      this.socket.readable
    ) {
      this.currentRequest = this.queue.shift();
      if (this.currentRequest.cmd === "ABOR" && this.pasvSocket)
        this.pasvSocket.aborting = true;
      this.debug &&
        this.debug(`[connection] > ${inspect(this.currentRequest.cmd)}`);
      this.socket.write(`${this.currentRequest.cmd}\r\n`);
    } else if (!this.currentRequest && !queueLen && this._ending) this.reset();
  }

  list(path: string, zcomp?: boolean, cb?: FTPCallback): void {
    let cmd;

    if (typeof path === "function") {
      // list(function() {})
      cb = path;
      path = undefined;
      cmd = "LIST";
      zcomp = false;
    } else if (typeof path === "boolean") {
      // list(true, function() {})
      cb = zcomp;
      zcomp = path;
      path = undefined;
      cmd = "LIST";
    } else if (typeof zcomp === "function") {
      // list('/foo', function() {})
      cb = zcomp;
      cmd = `LIST ${path}`;
      zcomp = false;
    } else cmd = `LIST ${path}`;

    this.pasv(function (err, sock) {
      if (err) return cb(err);

      if (this.queue[0] && this.queue[0].cmd === "ABOR") {
        sock.destroy();
        return cb();
      }

      let sockerr;
      let done = false;
      let replies = 0;
      let entries;
      let buffer = "";
      let source = sock;

      const ondone = () => {
        done = true;
        final();
      };

      if (zcomp) {
        source = zlib.createInflate();
        sock.pipe(source);
      }

      source.on("data", function (chunk) {
        buffer += chunk.toString("binary");
      });
      source.once("error", function (err) {
        if (!sock.aborting) sockerr = err;
      });
      source.once("end", ondone);
      source.once("close", ondone);

      function final() {
        if (done && replies === 2) {
          replies = 3;
          if (sockerr)
            return cb(
              new Error(`Unexpected data connection error: ${sockerr}`)
            );
          if (sock.aborting) return cb();

          // process received data
          entries = buffer.split(RE_EOL);
          entries.pop(); // ending EOL
          const parsed = [];
          for (let i = 0, len = entries.length; i < len; ++i) {
            const parsedVal = Parser.parseListEntry(entries[i]);
            if (parsedVal !== null) parsed.push(parsedVal);
          }

          if (zcomp)
            this.send(
              "MODE S",
              function () {
                cb(undefined, parsed);
              },
              true
            );
          else cb(undefined, parsed);
        }
      }

      if (zcomp)
        this.send(
          "MODE Z",
          function (err, text, code) {
            if (err) {
              sock.destroy();
              return cb(getFTPError(code, "Compression not supported"));
            }
            sendList();
          },
          true
        );
      else sendList();

      function sendList() {
        /*
         * this callback will be executed multiple times, the first is when server
         * replies with 150 and then a final reply to indicate whether the
         * transfer was actually a success or not
         */
        this.send(
          cmd,
          function (err, text, code) {
            if (err) {
              sock.destroy();
              if (zcomp)
                this.send(
                  "MODE S",
                  function () {
                    cb(err);
                  },
                  true
                );
              else cb(err);
              return;
            }

            // some servers may not open a data connection for empty directories
            if (++replies === 1 && code === 226) {
              replies = 2;
              sock.destroy();
              final();
            } else if (replies === 2) final();
          },
          true
        );
      }
    });
  }

  get(path, zcomp, cb) {
    if (typeof zcomp === "function") {
      cb = zcomp;
      zcomp = false;
    }

    this.pasv((err, socket) => {
      if (err) return cb(err);

      if (this.queue[0] && this.queue[0].cmd === "ABOR") {
        socket.destroy();
        return cb();
      }

      /*
       * modify behavior of socket events so that we can emit 'error' once for
       * either a TCP-level error OR an FTP-level error response that we get when
       * the socket is closed (e.g. the server ran out of space).
       */
      let sockerr;
      let started = false;
      let lastreply = false;
      let done = false;
      let source = socket;

      const ondone = () => {
        if (done && lastreply)
          this.send(
            "MODE S",
            () => {
              source._emit("end");
              source._emit("close");
            },
            true
          );
      };

      if (zcomp) {
        source = zlib.createInflate();
        socket.pipe(source);
        socket._emit = socket.emit;
        socket.emit = function (ev, arg1) {
          if (ev === "error") {
            if (!sockerr) sockerr = arg1;
            return;
          }
          socket._emit.apply(socket, Array.prototype.slice.call(arguments));
        };
      }

      source._emit = source.emit;
      source.emit = function (ev, arg1) {
        if (ev === "error") {
          if (!sockerr) sockerr = arg1;
          return;
        } else if (ev === "end" || ev === "close") {
          if (!done) {
            done = true;
            ondone();
          }
          return;
        }
        source._emit.apply(source, Array.prototype.slice.call(arguments));
      };

      socket.pause();

      if (zcomp)
        this.send(
          "MODE Z",
          function (err, text, code) {
            if (err) {
              socket.destroy();
              return cb(getFTPError(code, "Compression not supported"));
            }
            sendRetr();
          },
          true
        );
      else sendRetr();

      function sendRetr() {
        /*
         * this callback will be executed multiple times, the first is when server
         * replies with 150, then a final reply after the data connection closes
         * to indicate whether the transfer was actually a success or not
         */
        this.send(
          `RETR ${path}`,
          function (err, text, code) {
            if (sockerr || err) {
              socket.destroy();
              if (!started)
                if (zcomp) {
                  this.send(
                    "MODE S",
                    function () {
                      cb(sockerr || err);
                    },
                    true
                  );
                } else cb(sockerr || err);
              else {
                source._emit("error", sockerr || err);
                source._emit("close", true);
              }
              return;
            }
            /*
             * server returns 125 when data connection is already open; we treat it
             * just like a 150
             */
            if (code === 150 || code === 125) {
              started = true;
              cb(undefined, source);
              socket.resume();
            } else {
              lastreply = true;
              ondone();
            }
          },
          true
        );
      }
    });
  }
  put(input, path, zcomp, cb) {
    this.store(`STOR ${path}`, input, zcomp, cb);
  }

  append(input, path, zcomp, cb) {
    this.store(`APPE ${path}`, input, zcomp, cb);
  }

  pwd(cb) {
    // PWD is optional
    this.send("PWD", function (err, text, code) {
      if (code === 502)
        return this.cwd(
          ".",
          function (cwderr, cwd) {
            if (cwderr) return cb(cwderr);
            if (cwd === undefined) cb(err);
            else cb(undefined, cwd);
          },
          true
        );
      else if (err) return cb(err);
      cb(undefined, RE_WD.exec(text)[1]);
    });
  }

  cdup(cb) {
    // CDUP is optional
    this.send("CDUP", function (err, text, code) {
      if (code === 502) this.cwd("..", cb, true);
      else cb(err);
    });
  }

  mkdir(path, recursive, cb) {
    // MKD is optional
    if (typeof recursive === "function") {
      cb = recursive;
      recursive = false;
    }
    if (!recursive) this.send(`MKD ${path}`, cb);
    else {
      let owd;
      let abs;
      let dirs;
      let dirslen;
      let i = -1;
      let searching = true;

      abs = path[0] === "/";

      var nextDir = function () {
        if (++i === dirslen)
          // return to original working directory
          return this.send(`CWD ${owd}`, cb, true);

        if (searching)
          this.send(
            `CWD ${dirs[i]}`,
            function (err, text, code) {
              if (code === 550) {
                searching = false;
                --i;
              } else if (err)
                // return to original working directory
                return this.send(
                  `CWD ${owd}`,
                  function () {
                    cb(err);
                  },
                  true
                );

              nextDir();
            },
            true
          );
        else
          this.send(
            `MKD ${dirs[i]}`,
            function (err, text, code) {
              if (err)
                // return to original working directory
                return this.send(
                  `CWD ${owd}`,
                  function () {
                    cb(err);
                  },
                  true
                );

              this.send(`CWD ${dirs[i]}`, nextDir, true);
            },
            true
          );
      };
      this.pwd(function (err, cwd) {
        if (err) return cb(err);
        owd = cwd;
        if (abs) path = path.substr(1);
        if (path[path.length - 1] === "/")
          path = path.substring(0, path.length - 1);
        dirs = path.split("/");
        dirslen = dirs.length;
        if (abs)
          this.send(
            "CWD /",
            function (err) {
              if (err) return cb(err);
              nextDir();
            },
            true
          );
        else nextDir();
      });
    }
  }

  rmdir(path, recursive, cb) {
    // RMD is optional
    if (typeof recursive === "function") {
      cb = recursive;
      recursive = false;
    }
    if (!recursive) return this.send(`RMD ${path}`, cb);

    this.list(path, (err, list) => {
      if (err) return cb(err);
      let idx = 0;

      // this function will be called once per listing entry
      let deleteNextEntry;
      deleteNextEntry = function (err) {
        if (err) return cb(err);
        if (idx >= list.length) {
          if (list[0] && list[0].name === path) return cb(null);

          return this.rmdir(path, cb);
        }

        const entry = list[idx++];

        // get the path to the file
        let subpath = null;
        if (entry.name[0] === "/")
          /*
           * this will be the case when you call deleteRecursively() and pass
           * the path to a plain file
           */
          subpath = entry.name;
        else if (path[path.length - 1] == "/") subpath = path + entry.name;
        else subpath = `${path}/${entry.name}`;

        // delete the entry (recursively) according to its type
        if (entry.type === "d") {
          if (entry.name === "." || entry.name === "..")
            return deleteNextEntry();

          this.rmdir(subpath, true, deleteNextEntry);
        } else this.delete(subpath, deleteNextEntry);
      };
      deleteNextEntry();
    });
  }

  system(cb) {
    // SYST is optional
    this.send("SYST", function (err, text) {
      if (err) return cb(err);
      cb(undefined, RE_SYST.exec(text)[1]);
    });
  }

  // "Extended" (RFC 3659) commands
  size(path, cb) {
    this.send(`SIZE ${path}`, function (err, text, code) {
      if (code === 502)
        // Note: this may cause a problem as list() is _appended_ to the queue
        return this.list(
          path,
          function (err, list) {
            if (err) return cb(err);
            if (list.length === 1) cb(undefined, list[0].size);
            /*
             * path could have been a directory and we got a listing of its
             * contents, but here we echo the behavior of the real SIZE and
             * return 'File not found' for directories
             */ else cb(new Error("File not found"));
          },
          true
        );
      else if (err) return cb(err);
      cb(undefined, parseInt(text, 10));
    });
  }

  lastMod(path, cb) {
    this.send(`MDTM ${path}`, function (err, text, code) {
      if (code === 502)
        return this.list(
          path,
          function (err, list) {
            if (err) return cb(err);
            if (list.length === 1) cb(undefined, list[0].date);
            else cb(new Error("File not found"));
          },
          true
        );
      else if (err) return cb(err);
      const val = exec(text, REX_TIMEVAL);
      let ret;
      if (!val) return cb(new Error("Invalid date/time format from server"));
      ret = new Date(
        `${val.year}-${val.month}-${val.date}T${val.hour}:${val.minute}:${val.second}`
      );
      cb(undefined, ret);
    });
  }

  restart(offset, cb) {
    this.send(`REST ${offset}`, cb);
  }

  private pasv(cb) {
    let first = true;
    let ip;
    let port;
    this.send("PASV", function reentry(err, text) {
      if (err) return cb(err);

      this._curReq = undefined;

      if (first) {
        const m = RE_PASV.exec(text);
        if (!m) return cb(new Error("Unable to parse PASV server response"));
        ip = m[1];
        ip += ".";
        ip += m[2];
        ip += ".";
        ip += m[3];
        ip += ".";
        ip += m[4];
        port = parseInt(m[5], 10) * 256 + parseInt(m[6], 10);

        first = false;
      }
      this.pasvConnect(ip, port, function (err, sock) {
        if (err) {
          /*
           * try the IP of the control connection if the server was somehow
           * misconfigured and gave for example a LAN IP instead of WAN IP over
           * the Internet
           */
          if (this._socket && ip !== this._socket.remoteAddress) {
            ip = this._socket.remoteAddress;
            return reentry();
          }

          // automatically abort PASV mode
          this.send(
            "ABOR",
            function () {
              cb(err);
              this.send();
            },
            true
          );

          return;
        }
        cb(undefined, sock);
        this.send();
      });
    });
  }

  private pasvConnect(ip, port, cb) {
    let socket = new Socket();
    let sockerr;
    let timedOut = false;
    const timer = setTimeout(function () {
      timedOut = true;
      socket.destroy();
      cb(new Error("Timed out while making data connection"));
    }, this.options.pasvTimeout);

    socket.setTimeout(0);

    socket.once("connect", function () {
      this._debug && this._debug("[connection] PASV socket connected");
      if (this.options.secure === true) {
        this.options.secureOptions.socket = socket;
        this.options.secureOptions.session = this._socket.getSession();
        // socket.removeAllListeners('error');
        socket = tls.connect(this.options.secureOptions);
        // socket.once('error', onerror);
        socket.setTimeout(0);
      }
      clearTimeout(timer);
      this.pasvSocket = socket;
      cb(undefined, socket);
    });
    socket.once("error", onerror);
    function onerror(err) {
      sockerr = err;
    }
    socket.once("end", function () {
      clearTimeout(timer);
    });
    socket.once("close", function (had_err) {
      clearTimeout(timer);
      if (!this.pasvSocket && !timedOut) {
        let errmsg = "Unable to make data connection";
        if (sockerr) {
          errmsg += `( ${sockerr})`;
          sockerr = undefined;
        }
        cb(new Error(errmsg));
      }
      this.pasvSocket = undefined;
    });

    socket.connect(port, ip);
  }

  private store(cmd, input, zcomp, cb) {
    const isBuffer = Buffer.isBuffer(input);

    if (!isBuffer && input.pause !== undefined) input.pause();

    if (typeof zcomp === "function") {
      cb = zcomp;
      zcomp = false;
    }

    this.pasv(function (err, sock) {
      if (err) return cb(err);

      if (this._queue[0] && this._queue[0].cmd === "ABOR") {
        sock.destroy();
        return cb();
      }

      let sockerr;
      let dest = sock;
      sock.once("error", function (err) {
        sockerr = err;
      });

      if (zcomp)
        this.send(
          "MODE Z",
          function (err, text, code) {
            if (err) {
              sock.destroy();
              return cb(getFTPError(code, "Compression not supported"));
            }
            // draft-preston-ftpext-deflate-04 says min of 8 should be supported
            dest = zlib.createDeflate({ level: 8 });
            dest.pipe(sock);
            sendStore();
          },
          true
        );
      else sendStore();

      function sendStore() {
        /*
         * this callback will be executed multiple times, the first is when server
         * replies with 150, then a final reply after the data connection closes
         * to indicate whether the transfer was actually a success or not
         */
        this.send(
          cmd,
          function (err, text, code) {
            if (sockerr || err) {
              if (zcomp)
                this.send(
                  "MODE S",
                  function () {
                    cb(sockerr || err);
                  },
                  true
                );
              else cb(sockerr || err);
              return;
            }

            if (code === 150 || code === 125)
              if (isBuffer) dest.end(input);
              else if (typeof input === "string") {
                // check if input is a file path or just string data to store
                fs.stat(input, function (err, stats) {
                  if (err) dest.end(input);
                  else fs.createReadStream(input).pipe(dest);
                });
              } else {
                input.pipe(dest);
                input.resume();
              }
            else if (zcomp) this.send("MODE S", cb, true);
            else cb();
          },
          true
        );
      }
    });
  }
}
