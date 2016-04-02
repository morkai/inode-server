# inode-server

Reads data from the iNode.pl Bluetooth Low Energy devices using BLE,
iNode LANs and iNode GSMs and exposes it through HTTP and MODBUS.

## Requirements

  * [Node.js](https://nodejs.org/) >= v4
  * [iNode.pl](https://inode.pl/index/s_lang/en) Bluetooth Low Energy devices
  * Bluetooth Low Energy adapter (optional, Raspberry PI 3 is fine; see
    the [noble's Prerequisites section](https://github.com/sandeepmistry/noble))

## Install

```
git clone https://github.com/morkai/inode-server.git
cd inode-server
npm install
```

## Usage

Start with a config file (`config.json`) from the current working directory:
```
npm start
```

Start with a custom config file:
```
npm start -- ./example/config.json
```

### HTTP

If the `http` module is enabled, then all devices are available under
the `/devices` resource.

A single device is accessible through `/devices/<mac-address>`
or `/devices/<modbus-unit>`.

iNode GSM can `POST` data to the `http.gsmUploadUrl` resource.

### MODBUS

If there are any `slaves` defined, then all devices are available through MODBUS.

See the [h5.modbus.inode](https://github.com/morkai/h5.modbus.inode)
project for information about the exposed registers.

## Configuration

Configuration is specified in a JSON file passed to the `server.js` as
the first argument.

```json
{
  // Auto-discovery - whether to add or ignore devices that are not present
  // in the `devices` list specified below. Auto-discovered devices are
  // mapped to the next free MODBUS unit.
  "autoDiscovery": {
    // Enable/disable the auto discovery. Defaults to `true`.
    "enabled": true,
    // Whether to update the config file with the auto-discovered devices.
    // Defaults to `false`.
    "remember": false
  },
  // Bluetooth Low Energy - whether to scan the BLE network for devices.
  "ble": {
    // Enable/disable the BLE scanning. Defaults to `true`.
    "enabled": true
  },
  // HTTP server - whether to expose the device data through HTTP GET
  // and accept the iNode GSM data through HTTP POST.
  "http": {
    // Enable/disable the HTTP server. Defaults to `true`.
    "enabled": true,
    // GSM data upload endpoint. Defaults to `null` (disabled).
    "gsmUploadUrl": "/1337",
    // Path to a file where the latest GSM data for each device should
    // be stored. The data will be read from this file at startup.
    // Data older than `gsmReportRestoreTime` will be ignored.
    // Defaults to `null` (disabled).
    "gsmReportDumpPath": "./reports.json",
    // Max age (in minutes) of the GSM data in the `gsmReportDumpPath`.
    "gsmReportRestoreTime": 15,
    // Host to bind to. Defaults to `0.0.0.0` (all network interfaces).
    "host": "0.0.0.0",
    // Port to bind to. Defaults to `80`.
    "port": 80
  },
  // List of known devices. Data from devices not on this list will be
  // ignored if the auto-discovery is disabled.
  "devices": [
    {
      // Unique ID of the device. Used for logging purposes only.
      "id": "cs3-1",
      // Enable/disable the device. Defaults to `true`.
      "enabled": true,
      // MODBUS unit to map to.
      "unit": 1,
      // MAC address of the device.
      "mac": "00:12:6F:6D:3E:06"
    },
    {
      "id": "cs3-2",
      "enabled": true,
      "unit": 2,
      "mac": "00:12:6F:6D:3C:55"
    }
  ],
  // MODBUS slaves.
  "slaves": [
    // `h5.modbus.Slave` configuration.
    {
      // Unique ID of the slave. Used for logging purposes only.
      "id": "slave-tcp-1",
      // Enable/disable the slave. Defaults to `true`.
      "enabled": true,
      // Number of buffer overflows after which the connection should be
      // banned for 10s. Defaults to `Infinity` (disabled).
      "maxBufferOverflows": 3,
      // `h5.modbus.Transport` configuration.
      "transport": {
        "type": "ip"
      },
      // `h5.modbus.Listener` configuration.
      "listener": {
        "tcp": "tcp",
        "serverOptions": {
          "host": "0.0.0.0",
          "port": 502
        }
      }
    }
  ],
  // List of iNode LANs on the network.
  "lans": [
    {
      // Unique ID of the connection. Used for logging purposes only.
      "id": "lan-1",
      // Enable/disable the connection. Defaults to `true`.
      "enabled": true,
      "socketOptions": {
        // iNode LAN IP address
        "host": "192.168.1.210",
        // iNode LAN TCP socket port
        "port": 5500
      },
      // Time since the last data buffer was received after which
      // the connection is closed and reopened. Helps to automatically
      // re-establish the connection if someone opened the iNode LAN
      // monitor app.
      "noActivityTime": 15000
    }
  ]
}
```

## License

This project is released under the [MIT License](https://raw.github.com/morkai/inode-server/master/license.md).
