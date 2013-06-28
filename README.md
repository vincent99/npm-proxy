npm-proxy
=========

Proxy to allow talking to an internal NPM repository and fall back to the public one when a package is not found

Configuration
==========
Create a npm-proxy.config.json:
```javascript
{
  "listenPort": 5985,
  "internalNpm": "http://your-internal-npm:5984",
  "publicNpm": "http://registry.npmjs.org"
}
```
