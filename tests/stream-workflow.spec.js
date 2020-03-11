/*!
 * stream-workflow
 * Copyright(c) 2019 Benoît Claveau <benoit.claveau@gmail.com>
 * MIT Licensed
 */
const expect = require("expect.js");
const fs = require("fs");
const { promisify } = require("util");
const StreamFlow = require("../index");
const JSONStream = require("JSONStream");
const {
    Readable,
    Transform,
    PassThrough,
    pipeline
} = require('stream');


const pipelineAsync = promisify(pipeline);

describe("stream-workflow", () => {

    it("create a StreamFlow", async () => {
        const transform1 = new Transform({
            objectMode: true,
            transform(chunk, encoding, callback) {
                //console.log("\t", chunk.key);
                callback(null, {
                    ...chunk,
                    key: chunk.key.toUpperCase()
                });
            }
        })

        const transform2 = new Transform({
            objectMode: true,
            transform(chunk, encoding, callback) {
                //console.log("\t\t", chunk.key);
                callback(null, {
                    ...chunk,
                    key: chunk.key.replace(/ /g, ";")
                });
            }
        })

        const flow = new StreamFlow({
            objectMode: true,
            init(stream) {
                return pipeline(
                    stream,
                    transform1,
                    transform2,
                    error => error && this.emit("error", error)
                )
            }
        });

        let cpt = 0;
        const buffer = [];
        await pipelineAsync(
            fs.createReadStream(`${__dirname}/data/npm.array.json`),
            JSONStream.parse("*"),
            flow,
            new Transform({
                objectMode: true,
                transform(chunk, enc, cb) {
                    cb(null, chunk);
                }
            })
                .on("data", data => {
                    cpt++;
                    buffer.push(data);
                    console.log(data.key);
                    if (cpt == 100) {
                        console.log("** PAUSE **");
                        transform1.pause();
                        setTimeout(() => {
                            console.log("** RESUME **");
                            transform1.resume();
                        }, 2000);
                    }
                })
        )
        expect(buffer.length).to.be(4028);
        expect(buffer[1]).to.eql({
            id: "3scale",
            key: "3SCALE",
            value: {
                rev: "3-db3d574bf0ecdfdf627afeaa21b4bdaa"
            }
        });
        expect(buffer[4027]).to.eql({
            id: "zutil",
            key: "ZUTIL",
            value: {
                rev: "9-3e7bc6520008b4fcd5ee6eb9e8e5adf5"
            }
        });
    }).timeout(30000);

    it("throw an error in a StreamFlow pipe()", async () => {
        const stream = new ArrayToStream(["Execute multiples", "pipes inside", "a stream"]);
        const flow = new StreamFlow({
            objectMode: true,
            init(stream) {
                return stream
                    .pipe(new Transform({
                        objectMode: true,
                        transform(chunk, encoding, callback) {
                            if (chunk == "pipes inside")
                                callback(new Error("Test"))
                            else callback(null, chunk.toUpperCase());
                        }
                    })).on("error", error => this.emit("error", error))
                    .pipe(new Transform({
                        objectMode: true,
                        transform(chunk, encoding, callback) {
                            callback(null, chunk);
                        }
                    }))
            }
        });

        try {
            await pipelineAsync(
                stream, 
                flow,
                new PassThrough({ objectMode: true }), // HACK https://github.com/nodejs/node/commit/4d93e105bfad79ff6c6f01e4b7c2fdd70caeb43b
            );
            throw new Error();
        }
        catch (error) {
            expect(error.message).to.be("Test");
        }
    }).timeout(20000);

    it("throw an error in a StreamFlow pipeline mid", async () => {
        const stream = new ArrayToStream(["Execute multiples", "pipes inside", "a stream"]);
        const flow = new StreamFlow({
            objectMode: true,
            init(stream) {
                return pipeline(
                    stream,
                    new Transform({
                        objectMode: true,
                        transform(chunk, encoding, callback) {
                            callback(null, chunk);
                        }
                    }),
                    new Transform({
                        objectMode: true,
                        transform(chunk, encoding, callback) {
                            if (chunk == "pipes inside")
                                callback(new Error("Test"))
                            else callback(null, chunk.toUpperCase());
                        }
                    }),
                    new Transform({
                        objectMode: true,
                        transform(chunk, encoding, callback) {
                            callback(null, chunk);
                        }
                    }),
                    error => {
                        if (error) this.emit("error", error);
                    }
                );
            }
        });

        try {
            await pipelineAsync(
                stream, 
                flow,
                new PassThrough({ objectMode: true }), // HACK https://github.com/nodejs/node/commit/4d93e105bfad79ff6c6f01e4b7c2fdd70caeb43b
            );
            throw new Error();
        }
        catch (error) {
            expect(error.message).to.be("Test");
        }
    });

    it("throw an error in a StreamFlow pipeline first", async () => {
        const stream = new ArrayToStream(["Execute multiples", "pipes inside", "a stream"]);
        const flow = new StreamFlow({
            objectMode: true,
            init(stream) {
                return pipeline(
                    stream,
                    new Transform({
                        objectMode: true,
                        transform(chunk, encoding, callback) {
                            if (chunk == "pipes inside")
                                callback(new Error("Test"))
                            else callback(null, chunk.toUpperCase());
                        },
                    }),
                    new PassThrough({ objectMode: true }), // HACK https://github.com/nodejs/node/commit/4d93e105bfad79ff6c6f01e4b7c2fdd70caeb43b
                    error => {
                        if (error) this.emit("error", error);
                    }
                );
            }
        });

        try {
            await pipelineAsync(
                stream,
                flow,
                new PassThrough({ objectMode: true }), // HACK https://github.com/nodejs/node/commit/4d93e105bfad79ff6c6f01e4b7c2fdd70caeb43b
            );
            throw new Error();
        }
        catch (error) {
            expect(error.message).to.be("Test");
        }
    });

    it("throw an error in a StreamFlow pipeline last", async () => {
        const stream = new ArrayToStream(["Execute multiples", "pipes inside", "a stream"]);
        const flow = new StreamFlow({
            objectMode: true,
            init(stream) {
                return pipeline(
                    stream,
                    new Transform({
                        objectMode: true,
                        transform(chunk, encoding, callback) {
                            callback(null, chunk);
                        }
                    }),
                    new Transform({
                        objectMode: true,
                        transform(chunk, encoding, callback) {
                            if (chunk == "pipes inside")
                                callback(new Error("Test"))
                            else callback(null, chunk.toUpperCase());
                        }
                    }),
                    error => {
                        if (error) this.emit("error", error);
                    }
                );
            }
        });

        try {
            await pipelineAsync(
                stream, 
                flow,
                new PassThrough({ objectMode: true }), // HACK https://github.com/nodejs/node/commit/4d93e105bfad79ff6c6f01e4b7c2fdd70caeb43b
            );
            throw new Error();
        }
        catch (error) {
            expect(error.message).to.be("Test");
        }
    });
})

class ArrayToStream extends Readable {
    constructor(data) {
        super({ objectMode: true });
        this.data = data;
    };

    set data(data) {
        this.items = data;
    }

    _read() {
        try {
            const item = this.items.shift();
            this.push(item ? item : null);
        } catch (error) {
            this.emit("error", error);
        }
    }
};