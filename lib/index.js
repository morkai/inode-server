// Part of <http://miracle.systems/p/inode-server> licensed under <MIT>

'use strict';

const fs = require('fs');
const iNodeModbus = require('h5.modbus.inode');
const util = require('./util');
const setUpSlave = require('./slave');
const setUpLan = require('./lan');
const setUpDevice = require('./device');
const setUpBle = require('./ble');
const setUpHttp = require('./http');

const configFile = process.argv[2] || './config.json';
const configJson = fs.readFileSync(configFile, 'utf8');
const config = JSON.parse(configJson);

if (!Array.isArray(config.devices))
{
  config.devices = [];
}

let nextId = 0;
let saveConfigTimer = null;
let savingConfig = 0;
let shuttingDown = false;

const app = {
  config: JSON.parse(configJson),
  cleanup: [],
  gateway: new iNodeModbus.Gateway({
    unknownDeviceHandler: handleUnknownDevice
  }),
  nextId: prefix => `${prefix}-${++nextId}`
};

(app.config.devices || []).forEach(deviceConfig => setUpDevice(app, deviceConfig));
(app.config.slaves || []).forEach(slaveConfig => setUpSlave(app, slaveConfig));
(app.config.lans || []).forEach(lanConfig => setUpLan(app, lanConfig));
setUpBle(app, app.config.ble);
setUpHttp(app, app.config.http);

app.cleanup.push(app.gateway.destroy.bind(app.gateway, true));

process.on('SIGINT', function()
{
  if (shuttingDown)
  {
    return;
  }

  shuttingDown = true;

  util.log('Forcing shutdown in 333ms...');

  app.cleanup.forEach(cleanup => cleanup());

  setTimeout(() => process.exit(0), 333); // eslint-disable-line no-process-exit
});

/**
 * @private
 * @param {AdvertisingReport} report
 */
function handleUnknownDevice(report)
{
  if (!config.autoDiscovery || config.autoDiscovery.enabled === false)
  {
    return;
  }

  const options = {
    deviceTimeout: 30 * 60 * 1000
  };
  let device;

  for (let unit = 1; unit <= 255; ++unit)
  {
    device = new iNodeModbus.Device(report.address, unit, options);

    try
    {
      app.gateway.addDevice(device);

      break;
    }
    catch (err)
    {
      device = null;
    }
  }

  if (!device)
  {
    util.log(`Failed to add a new discovered device [${report.address}]: no free MODBUS units.`);

    return;
  }

  const deviceConfig = {
    id: 'auto-' + device.mac.replace(/:/g, '').substring(6),
    enabled: true,
    unit: device.unit,
    mac: device.mac
  };

  config.devices.push(deviceConfig);

  config.devices.sort((a, b) => a.unit - b.unit);

  util.log(`[${deviceConfig.id}] Mapping device [${deviceConfig.mac}] to unit [${deviceConfig.unit}]...`);

  if (config.autoDiscovery.remember)
  {
    scheduleSaveConfig();
  }
}

/**
 * @private
 */
function scheduleSaveConfig()
{
  if (saveConfigTimer)
  {
    clearTimeout(saveConfigTimer);
  }

  saveConfigTimer = setTimeout(function()
  {
    saveConfigTimer = null;
    saveConfig();
  }, 500);
}

/**
 * @private
 */
function saveConfig()
{
  ++savingConfig;

  if (savingConfig !== 1)
  {
    return;
  }

  util.log('Saving the config file...');

  fs.writeFile(configFile, JSON.stringify(config, null, 2), function(err)
  {
    if (err)
    {
      util.log(`Failed to save the config file: ${err.message}`);
    }

    if (savingConfig !== 1)
    {
      scheduleSaveConfig();
    }

    savingConfig = 0;
  });
}
