// Part of <http://miracle.systems/p/inode-server> licensed under <MIT>

'use strict';

const inspect = require('util').inspect;

/**
 * @param {...*} argN
 */
exports.log = function(argN) // eslint-disable-line no-unused-vars
{
  process.stdout.write(new Date().toISOString() + ' ');
  console.log.apply(console, arguments);
};

/**
 * @param {*} value
 * @param {number} [depth]
 */
exports.inspect = function(value, depth)
{
  exports.log(inspect(value, {colors: true, depth: depth || 5}));
};
