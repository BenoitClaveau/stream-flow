/*!
 * stream-workflow
 * Copyright(c) 2019 Benoît Claveau <benoit.claveau@gmail.com>
 * MIT Licensed
 */
const { UndefinedError } = require("oups");
const { Readable, Duplex, pipeline } = require('stream');
const { inspect } = require('util');
const eos = require('end-of-stream');

const EElistenerCount = (emitter, type) => {
    return emitter.listeners(type).length;
};

const needFinish = (state) => {
    return !state.destroyed;
}

/*
https://github.com/nodejs/node/commit/4d93e105bfad79ff6c6f01e4b7c2fdd70caeb43b
Hacking by adding a PassThrough
*/

/** 
 * new StreamWorflow({
 *   init(stream) {
 *      return pipelineAsync(
 *          stream,
 *          ...
 *      );
 *   }
 * )
 * Duplicate https://github.com/nodejs/readable-stream/blob/master/lib/_stream_transform.js
 * https://github.com/nodejs/node/blob/master/lib/_stream_transform.js
*/
class StreamWorflow extends Duplex {

    constructor(options = {}) {
        options.autoDestroy = false;
        super(options);

        if (!options.init) throw new UndefinedError("init flow function.");

        this._flowState = {
            init: false,
            initFn: options.init.bind(this),
            input: new InnerReadable({ objectMode: options.objectMode || options.readableObjectMode }),
            output: null,
            needTransform: false,
            pushing: false,
            writecb: null,
            writechunk: null,
            writeencoding: null
        };

        this._readableState.sync = false;

        this.on("prefinish", () => this.prefinish());
    }

    prefinish() {
        if (needFinish(this._flowState.input._readableState)) {
            this._flowState.input.push(null);
        }
    }

    init(chunk, encoding) {
        var ts = this._flowState;
        ts.output = ts.initFn(ts.input, chunk, encoding);
        if (!ts.output) {
            this.emit("error", new Error("Init function must return a stream."));
            return;
        }
        if (ts.output instanceof Promise) {
            this.emit("error", new Error("Promise is not supported."));
            return;
        }

        ts.output
            .on("data", data => {
                this.push(data);
            })
            .on("end", () => {
                this.push(null);
            })

        // output is finish
        eos(ts.output, error => {
            if (error) this.emit("error", error);
            // output is finish but stream-workflow not, so we emit finish.
            if (ts.output.writableFinished && !this.writableFinished) this.emit("finish");
        });

        ts.init = true;
    }

    _write(chunk, encoding, callback) {
        const ts = this._flowState;
        if (!ts.init) this.init(chunk, encoding);

        ts.writecb = callback;
        ts.writechunk = chunk;
        ts.writeencoding = encoding;

        if (!ts.pushing) {
            const rs = this._readableState;
            if (ts.needTransform || rs.needReadable || rs.length < rs.highWaterMark) this._read(rs.highWaterMark);
        }
    }

    push(chunk, encoding) {
        this._flowState.needTransform = false;
        return super.push(chunk, encoding);
    }

    _read(n) {
        const ts = this._flowState;
        if (ts.writechunk !== null && !ts.pushing) {
            ts.pushing = true;
            ts.needTransform = false;
            const ret = ts.input.push(ts.writechunk);
            if (ret)
                this.afterPushed();
            else {
                ts.input.once("drained", () => {
                    this.afterPushed(); // will close the callback
                    this.emit("drain");
                });
            }
        }
        else {
            ts.needTransform = true;
        }
    }

    afterPushed() {
        const ts = this._flowState;
        ts.pushing = false;

        const cb = ts.writecb;

        ts.writechunk = null;
        ts.writecb = null;

        cb();

        const rs = this._readableState;
        rs.reading = false;
        if (rs.needReadable || rs.length < rs.highWaterMark) {
            this._read(rs.highWaterMark);
        }
    }

    destroy(err, cb) {
        // input stream is not ended. Push null to end it.
        if (!this._flowState.input.readableEnded) {
            this._flowState.input.push(null); // push null to ended input stream
            return;
        }

        // output stream is not finish. Skip destroy for waitinf the finish of output stream
        if (!this._flowState.output.writableFinished) {
            return; 
        }

        super.destroy(err, cb)
    }
};

class InnerReadable extends Readable {

    pipe(dest) {
        const ret = super.pipe(dest);
        dest
            .on("drain", () => {
                this.emit("drained");
            })
            .on("resume", () => {
                this.emit("drained");
            })

        return ret;
    }

    _read(n) {
    }
}

module.exports = StreamWorflow;