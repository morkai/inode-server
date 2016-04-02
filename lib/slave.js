// Part of <http://miracle.systems/p/inode-server> licensed under <MIT>

'use strict';

const modbus = require('h5.modbus');
const util = require('./util');

module.exports = function setUpSlave(app, slaveConfig)
{
  if (!slaveConfig || typeof slaveConfig !== 'object')
  {
    return;
  }

  const slaveId = slaveConfig.id || app.nextId('slave');

  if (slaveConfig.enabled === false)
  {
    util.log(`[${slaveId}] Ignoring disabled slave.`);

    return;
  }

  util.log(`[${slaveId}] Setting up...`);

  slaveConfig.requestHandler = app.gateway.handleModbusRequest;

  const slave = modbus.createSlave(slaveConfig);

  app.cleanup.push(slave.destroy.bind(slave, true));

  slave.listener.on('open', () => util.log(`[${slaveId}] [listener#open]`));
  slave.listener.on('close', () => util.log(`[${slaveId}] [listener#close]`));
  slave.listener.on('error', err => util.log(`[${slaveId}] [listener#error] ${err.message}`));

  let clientCounter = 0;
  let timers = {};
  const maxBufferOverflows = parseInt(slaveConfig.maxBufferOverflows, 10) || Infinity;
  const addressToOverflowCountMap = new Map();

  app.cleanup.push(function()
  {
    Object.keys(timers).forEach(k => clearTimeout(timers[k]));
    timers = {};
  });

  slave.listener.on('client', function(client)
  {
    client.id = ++clientCounter;

    util.log(`[${slaveId}] [client#${client.id}] ${JSON.stringify(client.remoteInfo, null, 2)}`);

    if (addressToOverflowCountMap.get(client.remoteInfo.address) > maxBufferOverflows)
    {
      banClient(client);

      return;
    }

    const connectedAt = Date.now();

    client.on('error', err => util.log(`[${slaveId}] [client#${client.id}#error] ${err.message}`));
    client.on('close', () => util.log(`[${slaveId}] [client#${client.id}#close] ${(Date.now() - connectedAt) / 1000}s`));
    client.on('bufferOverflow', function(buffer)
    {
      const overflowCount = (addressToOverflowCountMap.get(client.remoteInfo.address) || 0) + 1;

      util.log(`[${slaveId}] [client#${client.id}#overflow] count=${overflowCount} length=${buffer.length}`);

      addressToOverflowCountMap.set(client.remoteInfo.address, overflowCount);

      if (overflowCount > maxBufferOverflows)
      {
        banClient(client);
      }
    });
  });

  function banClient(client)
  {
    util.log(`[${slaveId}] [client#${client.id}#ban]`);

    if (!timers[client.id])
    {
      timers[client.id] = setTimeout(unbanClient, 10000, client);
    }

    client.destroy();
  }

  function unbanClient(client)
  {
    util.log(`[${slaveId}] [client#${client.id}#unban]`);

    addressToOverflowCountMap.delete(client.remoteInfo.address);

    delete timers[client.id];
  }
};
