# StreamFlow

Encapsulate streams for use in object-oriented programming.

 [![NPM][npm-image]][npm-url]
 [![Build Status][travis-image]][travis-url]
 [![Coverage Status](https://coveralls.io/repos/github/BenoitClaveau/stream-workflow/badge.svg?branch=master)](https://coveralls.io/github/BenoitClaveau/stream-workflow?branch=master)
 [![NPM Download][npm-image-download]][npm-url]
 [![Dependencies Status][david-dm-image]][david-dm-url]

Replace transform stream

![Transform stream](https://raw.github.com/BenoitClaveau/stream-workflow/master/specs/classic.png)

```transform.js
const StreamFlow = require("stream-workflow");
const { Transform, pipeline } = require("stream");
const JSONStream = require("JSONStream");
const fs = require("fs");

fs.createReadStream(`data.json`)
    .pipe(JSONStream.parse("*"))
    .pipe(new Transform({
        objectMode: true,
        transform(chunk, enc, cb) {
            cb(null, chunk);
        }
    }));
```

by stream-workflow

![StreamWorkflow](https://raw.github.com/BenoitClaveau/stream-workflow/master/specs/workflow.png)

```stream-worflow.js
class CustomStream extends StreamFlow { {
    constructor({
        objectMode: true,
        init(stream) {              // init function must return the last stream of the pipeline.
            return pipeline(        
                stream,             // pathtrought stream
                JSONStream.parse(), // Transform 1 in diagram
                new Transform({     // Transform 2 in diagram
                    objectMode: true,
                    transform(chunk, enc, cb) {
                        cb(null, chunk);
                    }
                }),
                error => error && this.emit("error", error)
            )
        }
    })
}

fs.createReadStream(`data.json`)
    .pipe(new CustomStream());
```

## Test

To run our tests, clone the stream-workflow repo and install the dependencies.

```bash
$ git clone https://github.com/BenoitClaveau/stream-workflow --depth 1
$ cd stream-workflow
$ npm install
$ cd tests
$ node.exe "../node_modules/mocha/bin/mocha" .
```

[npm-image]: https://img.shields.io/npm/v/stream-workflow.svg
[npm-image-download]: https://img.shields.io/npm/dm/stream-workflow.svg
[npm-url]: https://npmjs.org/package/stream-workflow
[travis-image]: https://travis-ci.org/BenoitClaveau/stream-workflow.svg?branch=master
[travis-url]: https://travis-ci.org/BenoitClaveau/stream-workflow
[coveralls-image]: https://coveralls.io/repos/BenoitClaveau/stream-workflow/badge.svg?branch=master&service=github
[coveralls-url]: https://coveralls.io/github/BenoitClaveau/stream-workflow?branch=master
[david-dm-image]: https://david-dm.org/BenoitClaveau/stream-workflow/status.svg
[david-dm-url]: https://david-dm.org/BenoitClaveau/stream-workflow
