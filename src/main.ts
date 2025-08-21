import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import axios from 'axios';
import * as express1 from 'express';
import express from 'express';
import { env } from 'process';
const xml2js = require('xml2js');

/**
 * Function that get's the token from the service provider
 * @returns obtained token
 */
async function getToken() {
  let config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: env.LOGIN_URL,
    data: env.LOGINDATA
  };

  try {
    const res = await axios.request(config);
    const jsonObj = await extractJsonObject(res.data);
    return jsonObj.userInfo.key2018;
  } catch (_) {
    console.log('failed obtaining token')
    return null;
  }
}

/**
 * Function used to validate if a given timestamp is within the last 24h
 * 
 * @param timestamp timestamp to check
 * @returns if the timestamp is within desired timeline
 */
function isTimestampWithinLast24h(timestamp: string): boolean {
  const cleanedTimestamp = timestamp.replace(' ', 'T');
  const givenDate = new Date(cleanedTimestamp);
  const now = new Date();
  const limitTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return givenDate > limitTime;
}

/**
 * Function to convert the XML string to a JavaScript object
 * @param xml String that represents the xml data
 * @returns JSON object with the xml data
 */
function xmlToJs(xml) {
  return new Promise((resolve, reject) => {
    const parser = new xml2js.Parser();
    parser.parseString(xml, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

/**
 * Extract the JSON object from the XML
 * @param xmlString 
 * @returns 
 */
async function extractJsonObject(xmlString) {
  try {
    const xmlObject: any = await xmlToJs(xmlString);
    const jsonString = xmlObject.string._;
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Error extracting JSON object from XML:', error);
    return null;
  }
}

/**
 * Function to return a delay promise that can be awaited
 * @param ms desired delay in ms
 * @returns Promise
 */
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))


/**
 * Function that calculates the battery percentage, based on the vehicle battery
 * This helps remind me that a vehicle that sits too long parked should have his battery charged
 * or maybe that it's time to be sold (but still needs to be charged)
 * 
 * Due to the used vehicles having different battery chemistries and though different voltages, a easy away for my 
 * to develop a solution that wouldn't need to be coded every time a new vehicle is added, this considers a range from 11v to 13v
 * making a possibility that the percentage can go above 100, which is treated bellow
 * 
 * @param batt string with the baterry voltage(ex: 12.4)
 * @returns baterry percentage 0-100
 */
function battPercentage(batt: string) {
  let percentage = 0;
  const numericValue = parseFloat(batt);

  if (isNaN(numericValue)) {
    return '0';
  }

  percentage = ((numericValue - 11.0) / 2) * 100
  if (percentage > 100) percentage = 100;
  if (percentage < 0) percentage = 0;
  return percentage.toString();
}


let token = null;
let zones = null;
/**
 * Function that based on device coordinates and HA zones returns the adequate state
 * home, not_home or zone
 * 
 * Calculations based on gpt but good enougth for my use
 */
const makeDeviceState = (trackerData) => {
  if (zones) {
    for (const zone of zones) {
      //calculate distance
      const R = 6371000, toRad = (x: number) => x * Math.PI / 180;
      const p = toRad(zone?.attributes?.latitude - trackerData.lat), q = toRad(zone?.attributes?.longitude - trackerData.lng);
      const s = Math.sin(p / 2) ** 2 + Math.cos(toRad(trackerData.lat)) * Math.cos(toRad(zone?.attributes?.latitude)) * Math.sin(q / 2) ** 2;
      const dist = 2 * R * Math.asin(Math.sqrt(s));
      if (dist < zone?.attributes?.radius) {
        return zone?.attributes?.friendly_name;
      }
    }
  }
  return 'not_home';
}

/**
 * Function that runs every cycle to obtain the location data for all devices.
 * Verifies if there is a token, if not tries to obtain one
 * Having a token, it gets the data for all devices and if the device had an update within the last 24h it does update it on trackar to keep it alive
 * 
 * This is complementary to the default tracker application and not my main tracking solution, some automations could be trigered using the obtained data from this cron
 * 
 */
async function updateDevicesToTraccar() {
  if (!token) {
    token = await getToken();
  }

  if (token) {
    const axios = require('axios');
    let data = env.UPD_DEVICES_BASE_DATA + encodeURIComponent(token);

    let config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: env.UPD_DEVICES_URL,
      data: data
    };

    axios.request(config)
      .then((res) => {
        extractJsonObject(res.data)
          .then(async jsonObject => {
            for (const x of jsonObject.devices) {
              if (isTimestampWithinLast24h(x.positionTime)) {

                const deviceName = x.name.toLowerCase().replace(/\s+/g, "_");
                const updUrl = `${env.BASE_URL}/api/states/`;


                const baseConfig = {
                  method: 'post',
                  contentType: "application/json",
                  headers: {
                    authorization: 'Bearer ' + env.HATOKEN,
                  }
                };


                const trackerArgs = [
                  { name: 'ID', key: '_id', value: x.id },
                  { name: 'Latitude', key: '_latitude', value: x.lat },
                  { name: 'Longitude', key: '_longitude', value: x.lng },
                  { name: 'Speed', key: '_speed', value: x.speed },
                  { name: 'Battery Voltage', key: '_battery_voltage', value: x.dy },
                  { name: 'Battery Level', key: '_battery_level', value: battPercentage(x.dy) },
                  { name: 'Device Name', key: '_device_name', value: x.name },
                  { name: 'Position Time', key: '_position_time', value: x.positionTime },
                  { name: 'Is Stop', key: '_is_stop', value: x.isStop },
                  { name: 'Network', key: '_network', value: x.signal },
                  { name: 'GPS', key: '_gps', value: x.satellite },
                  { name: 'Glonass', key: '_glonass', value: x.satellitegl },
                  { name: 'Beidou', key: '_beidou', value: x.satellitebd },
                ]




                try {
                  await delay(1000)
                  //1 request per entity
                  for (const arg of trackerArgs) {
                    const argConf = {
                      ...baseConfig,
                      url: `${updUrl}sensor.micodus_${deviceName}${arg.key}`,
                      data: {
                        state: arg.value,
                      },
                    }
                    await axios.request(argConf);
                  }

                  const entityData = {
                    state: makeDeviceState(x),
                    attributes: Object.fromEntries(
                      trackerArgs.map(arg => {
                        const key = arg.key.includes("_")
                          ? arg.key.split(/_(.+)/, 2)[1]
                          : arg.key
                        return [key, arg.value]
                      })
                    )
                  }
                  //console.log('test', x, entityData)

                  await axios.request({
                    ...baseConfig,
                    url: `${updUrl}device_tracker.micodus_${deviceName}`,
                    data: entityData
                  });

                  //console.log('done', x, entityData)
                } catch (err) {
                  console.log('failed', x.id)
                }
              }
            }
          });
      })
      .catch((error) => {
        console.log(error);
      });
  }
}

/**
 * Function that runs every 4 hours to get the zones that are set on Homeassitant
 * As now we dont use trackar, we need to set that state manually
 */
const updateHAZones = () => {
  const axios = require('axios');

  let config = {
    method: 'get',
    url: `${env.BASE_URL}/api/states`,
    headers: {
      authorization: 'Bearer ' + env.HATOKEN,
    }
  };

  axios.request(config)
    .then((res) => {
      zones = res.data.filter((entity) => entity.entity_id.startsWith('zone.'));
    })
    .catch((error) => {
      console.log(error);
    });

}

/**
 * App initializer, calls the updateDevicesToTraccar every 8 secconds, a bit slower than the default for the android app
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  let expressApp;
  // Create an Express app
  try {
    expressApp = express1();
  } catch (_) {
    // Create an Express app
    expressApp = express();
  }

  // Use the Express app in NestJS
  app.use(expressApp);
  await app.listen(3000, () => {
    updateHAZones();
    updateDevicesToTraccar();
    setInterval(updateDevicesToTraccar, 8000);
    setInterval(updateHAZones, 4 * 60 * 60 * 1000);
  });
}

bootstrap();

