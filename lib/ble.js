// Part of <http://miracle.systems/p/inode-server> licensed under <MIT>

'use strict';

const btHci = require('h5.bluetooth.hci');
const iNodeHci = require('h5.bluetooth.hci.inode');
const util = require('./util');

module.exports = function setUpBle(app, bleConfig)
{
  if (!bleConfig || typeof bleConfig !== 'object')
  {
    return;
  }

  if (bleConfig.enabled === false)
  {
    util.log('[ble] Ignoring.');

    return;
  }

  const noble = require('noble');

  app.cleanup.push(noble.stopScanning.bind(noble));

  noble.on('stateChange', function(state)
  {
    util.log(`[ble#stateChange] ${state}`);

    if (state === 'poweredOn')
    {
      noble.startScanning([], true);
    }
    else
    {
      noble.stopScanning();
    }
  });

  noble.on('scanStart', () => util.log('[ble#scanStart]'));
  noble.on('scanStop', () => util.log('[ble#scanStop]'));

  noble.on('discover', function(peripheral)
  {
    const ad = peripheral.advertisement;
    const eventType = typeof ad.localName === 'undefined'
      ? btHci.AdvertisingReportEventType.AdvInd
      : btHci.AdvertisingReportEventType.ScanRsp;
    const addressType = peripheral.addressType === 'public'
      ? btHci.AdvertisingReportAddressType.Public
      : btHci.AdvertisingReportAddressType.Random;
    const report = {
      eventType: eventType,
      eventTypeLabel: btHci.AdvertisingReportEventType[eventType],
      addressType: addressType,
      addressTypeLabel: btHci.AdvertisingReportAddressType[addressType],
      address: peripheral.address.toUpperCase(),
      length: -1,
      data: [],
      rssi: peripheral.rssi
    };

    if (typeof ad.localName === 'string')
    {
      report.data.push({
        type: btHci.EirDataType.LocalNameShort,
        typeLabel: btHci.EirDataType[btHci.EirDataType.LocalNameShort],
        value: ad.localName
      });
    }

    if (typeof ad.txPowerLevel === 'number')
    {
      report.data.push({
        type: btHci.EirDataType.TxPowerLevel,
        typeLabel: btHci.EirDataType[btHci.EirDataType.TxPowerLevel],
        value: ad.txPowerLevel
      });
    }

    try
    {
      report.data.push(iNodeHci.decodeMsd(ad.manufacturerData));
    }
    catch (err) {} // eslint-disable-line no-empty

    if (report.data.length)
    {
      app.gateway.handleAdvertisingReport(report);
    }
  });
};
