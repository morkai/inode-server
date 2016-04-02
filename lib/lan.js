// Part of <http://miracle.systems/p/inode-server> licensed under <MIT>

'use strict';

const modbus = require('h5.modbus');
const util = require('./util');

module.exports = function setUpLan(app, lanConfig)
{
  if (!lanConfig || typeof lanConfig !== 'object')
  {
    return;
  }

  const lanId = lanConfig.id || app.nextId('lan');

  if (lanConfig.enabled === false)
  {
    util.log(`[${lanId}] Ignoring disabled LAN connection.`);

    return;
  }

  util.log(`[${lanId}] Setting up...`);

  const connection = modbus.createConnection(lanConfig);

  connection.on('open', () => util.log(`[${lanId}#open]`));
  connection.on('close', () => util.log(`[${lanId}#close]`));
  connection.on('error', err => util.log(`[${lanId}#error] ${err.message}`));

  app.gateway.addConnection(connection);
};
