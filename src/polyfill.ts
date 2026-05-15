import semver from 'semver';

if (semver.lt(process.version, '18.0.0')) {
  global.fetch = require('node-fetch');
}

