/*
  Copyright (c) 2013 Vincent Fiduccia

  Permission is hereby granted, free of charge, to any person obtaining a 
  copy of this software and associated documentation files (the "Software"), 
  to deal in the Software without restriction, including without limitation 
  the rights to use, copy, modify, merge, publish, distribute, sublicense, 
  and/or sell copies of the Software, and to permit persons to whom the 
  Software is furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in 
  all copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR 
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL 
  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING 
  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER 
  DEALINGS IN THE SOFTWARE.
*/

var util = require('util');
var http = require('http');
var urllib = require('url');

var conf = require('./npm-proxy.config.json');

var internalNpm = urllib.parse(conf.internalNpm);
var publicNpm = urllib.parse(conf.publicNpm);

var fwdProxy = false;
if ( conf.fwdProxy )
  fwdProxy = urllib.parse(conf.fwdProxy);

var server = http.createServer(request);

if ( conf.listenHost )
{
  console.log('Listening on',conf.listenHost+":"+conf.listenPort);
  server.listen(conf.listenHost, conf.listenPort);
}
else
{
  console.log('Listening on port', conf.listenPort);
  server.listen(conf.listenPort);
}

console.log('Internal:', urllib.format(internalNpm));
console.log('Public:', urllib.format(publicNpm));
if ( fwdProxy )
  console.log('Proxy:', urllib.format(fwdProxy));

function request(req, res)
{
  var body = '';

  req.on('data', function(chunk) {
    body += chunk;
  });

  req.on('end', function() {
    internalRequest(req, body, res);
  });
}

function internalRequest(req, body, res)
{
  var opt = {
    method: req.method,
    path: internalNpm.path.replace(/\/$/,'')+req.url,
    headers: req.headers,
    host: internalNpm.hostname,
    port: internalNpm.port
  }

  opt.headers.host = internalNpm.hostname+":"+internalNpm.port;
  delete opt.headers['cookie'];

  console.log('Checking internal NPM:', util.inspect(opt));

  var internal = http.request(opt, done);

  internal.on('error', function(err) {
    res.statusCode = 500;
    res.setHeader('Content-Type','text/plain');
    res.end(util.inspect(err));
  });

  internal.end(body);
  
  function done(internalRes)
  {
    if ( internalRes.statusCode >= 200 && internalRes.statusCode <= 399 )
    {
      console.log('Found in internal');
      res.statusCode = internalRes.statusCode;
      copyHeaders(internalRes,res);
      internalRes.pipe(res);
    }
    else
    {
      console.log("Didn't find in internal, checking public");
      publicRequest(req,body,res);
      internal.abort();
    }
  }
}

function publicRequest(req, body, res)
{
  var opt = {
    method: req.method,
    path: req.url,
    headers: req.headers,
    host: internalNpm.hostname,
    port: internalNpm.port
  }

  if ( fwdProxy )
  {
    opt.path = urllib.format(publicNpm).replace(/\/+$/,'')+ req.url;
    opt.protocol = fwdProxy.protocol;
    opt.host = fwdProxy.hostname;
    opt.port = fwdProxy.port;
    opt.headers.host = publicNpm.hostname;
  }

  delete opt.headers['authorization'];
  delete opt.headers['cookie'];

  console.log('Checking Public NPM:', util.inspect(opt));
  var pub = http.request(opt, done);

  pub.on('error', function(err) {
    res.statusCode = 500;
    res.setHeader('Content-Type','text/plain');
    res.end(util.inspect(err));
  });

  pub.end(body);
  
  function done(pubRes)
  {
    if ( pubRes.statusCode >= 200 && pubRes.statusCode <= 299 )
    {
      console.log('Found in public');
    }
    else
    {
      console.log("Didn't find in public, giving up");
    }

    res.statusCode = pubRes.statusCode;
    copyHeaders(pubRes,res);
    pubRes.pipe(res);
  }
}

function copyHeaders(from,to)
{
  var keys = Object.keys(from.headers);
  var k, v;
  for ( var i = 0 ; i < keys.length ; i++ )
  {
    k = keys[i];
    v = from.headers[k];
    to.setHeader(k,v);
  }
}
