// Part of <http://miracle.systems/p/inode-server> licensed under <MIT>

'use strict';

const http = require('http');
const url = require('url');
const fs = require('fs');
const iNodeHci = require('h5.bluetooth.hci.inode');
const prepareMacAddress = require('h5.modbus.inode/lib/helpers').prepareMacAddress;
const util = require('./util');

module.exports = function setUpHttp(app, httpConfig)
{
  if (!httpConfig || typeof httpConfig !== 'object')
  {
    return;
  }

  if (httpConfig.enabled === false)
  {
    util.log('[http] Ignoring.');

    return;
  }

  util.log('[http] Setting up...');

  let dumpingGsmReports = false;
  const gsmReportMap = {};
  const requestCounter = {
    value: 0,
    next: function() { return (++this.value).toString(36).toUpperCase(); }
  };

  restoreGsmReports();

  const httpServer = http.createServer();

  httpServer.listen(httpConfig.port || 80, httpConfig.host || '0.0.0.0');

  httpServer.on('listening', () => util.log('[http#listening]'));
  httpServer.on('close', () => util.log('[http#close]'));
  httpServer.on('error', err => util.log(`[http#error] ${err.message}`));

  httpServer.on('request', function(req, res)
  {
    const startedAt = Date.now();
    const id = requestCounter.next();
    const dataBuffers = [];
    let dataLength = 0;

    util.log(`[http] [request#${id}] [${req.socket.remoteAddress}]:${req.socket.remotePort} ${req.method} ${req.url}`);

    req.on('error', err => util.log(`[http] [request#${id}#error] ${err.message}`));

    req.on('readable', function()
    {
      const data = req.read();

      if (data)
      {
        dataBuffers.push(data);
        dataLength += data.length;
      }
    });

    req.on('end', function()
    {
      util.log(`[http] [request#${id}#end] ${dataLength}B in ${Date.now() - startedAt}ms`);

      handleRequest(id, req, res, Buffer.concat(dataBuffers, dataLength));
    });
  });

  function handleRequest(id, req, res, body)
  {
    if (req.url === httpConfig.gsmUploadUrl)
    {
      handleGsmUploadRequest(id, req, res, body);

      return;
    }

    if (/^\/devices/.test(req.url))
    {
      handleDevicesRequest(id, req, res, body);
    }

    res.writeHead(404);
    res.end();
  }

  /**
   * @private
   * @param {string} id
   * @param {IncomingMessage} req
   * @param {ServerResponse} res
   * @param {Buffer} body
   */
  function handleGsmUploadRequest(id, req, res, body)
  {
    if (req.method !== 'POST')
    {
      res.writeHead(405);
      res.end();

      return;
    }

    res.writeHead(204);
    res.end();

    const gsmTime = url.parse(req.url, true).query.time || -1;
    const reports = iNodeHci.decodeGsmData(gsmTime, body);

    dumpGsmReports(reports);

    reports.forEach(report => app.gateway.handleAdvertisingReport(report));
  }

  /**
   * @private
   * @param {string} id
   * @param {IncomingMessage} req
   * @param {ServerResponse} res
   * @param {Buffer} body
   */
  function handleDevicesRequest(id, req, res, body)
  {
    if (req.url === '/devices')
    {
      if (req.method !== 'GET')
      {
        res.writeHead(405);
        res.end();

        return;
      }

      res.writeHead(200, {
        'Content-Type': 'application/json'
      });
      res.end(JSON.stringify(app.gateway.getDevices(), null, 2));

      return;
    }

    const matches = req.url.match(/^\/devices\/([0-9]+|(?:[A-Fa-f0-9]:?){5}:?[A-Fa-f0-9])/);

    if (matches)
    {
      const address = /^[0-9]+$/.test(matches[1]) ? +matches[1] : prepareMacAddress(matches[1]);

      handleDeviceRequest(id, req, res, body, app.gateway.getDevice(address));

      return;
    }

    res.writeHead(404);
    res.end();
  }

  /**
   * @private
   * @param {string} id
   * @param {IncomingMessage} req
   * @param {ServerResponse} res
   * @param {Buffer} body
   * @param {?Device} device
   */
  function handleDeviceRequest(id, req, res, body, device)
  {
    if (!device)
    {
      res.writeHead(404);
      res.end();

      return;
    }

    if (req.method !== 'GET')
    {
      res.writeHead(405);
      res.end();

      return;
    }

    res.writeHead(200, {
      'Content-Type': 'application/json'
    });
    res.end(JSON.stringify(device, null, 2));
  }

  /**
   * @private
   */
  function restoreGsmReports()
  {
    if (!httpConfig.gsmReportDumpPath)
    {
      return;
    }

    let gsmReportList = [];

    try
    {
      gsmReportList = JSON.parse(fs.readFileSync(httpConfig.gsmReportDumpPath, 'utf8'));
    }
    catch (err)
    {
      util.log(`Failed to restore GSM reports from file: ${err.message}`);

      return;
    }

    const oldAt = Date.now() - (httpConfig.gsmReportRestoreTime || 720) * 60 * 1000;

    gsmReportList = gsmReportList.filter(r => r.receivedAt >= oldAt);
    gsmReportList.forEach(restoreGsmReport);

    util.log(`Restored ${gsmReportList.length} GSM reports from file.`);
  }

  /**
   * @private
   * @param {AdvertisingReport} report
   */
  function restoreGsmReport(report)
  {
    gsmReportMap[report.address] = report;

    app.gateway.handleAdvertisingReport(report);
  }

  /**
   * @private
   * @param {Array<AdvertisingReport>} reports
   */
  function dumpGsmReports(reports)
  {
    if (dumpingGsmReports || !httpConfig.gsmReportDumpPath)
    {
      return;
    }

    dumpingGsmReports = true;

    const now = Date.now();

    reports.forEach(function(report)
    {
      report.receivedAt = now;
      gsmReportMap[report.address] = report;
    });

    const gsmReportList = [];

    Object.keys(gsmReportMap).forEach(k => gsmReportList.push(gsmReportMap[k]));

    fs.writeFile(httpConfig.gsmReportDumpPath, JSON.stringify(gsmReportList, null, 2), function(err)
    {
      if (err)
      {
        util.log(`Failed to dump GSM reports to file: ${err.message}`);
      }
      else
      {
        util.log(`Dumped ${gsmReportList.length} GSM reports to file.`);
      }

      dumpingGsmReports = false;
    });
  }
};
