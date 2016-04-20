// Part of <http://miracle.systems/p/inode-server> licensed under <MIT>

'use strict';

const iNodeModbus = require('h5.modbus.inode');
const util = require('./util');

module.exports = function setUpDevice(app, deviceConfig)
{
  if (!deviceConfig || typeof deviceConfig !== 'object')
  {
    return;
  }

  const deviceId = deviceConfig.id || app.nextId('device');

  if (deviceConfig.enabled === false)
  {
    util.log(`[${deviceId}] Ignoring.`);

    return;
  }

  util.log(`[${deviceId}] Mapping device [${deviceConfig.mac}] to unit [${deviceConfig.unit}]...`);

  try
  {
    app.gateway.addDevice(new iNodeModbus.Device(deviceConfig.mac, deviceConfig.unit, deviceConfig));
  }
  catch (err)
  {
    util.log(`[${deviceId}#error] ${err.message}`);
  }
};
