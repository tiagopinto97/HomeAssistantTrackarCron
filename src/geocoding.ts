const fs = require('fs');
const path = require('path');

import { env } from 'process';

// Path to cache file
const CACHE_FILE = path.join(process.cwd(), "geoCache.json");

// Load cache from file
function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
    }
  } catch (err) {
    console.error("Error loading cache:", err);
  }
  return [];
}

// Save cache to file
function saveCache(cache) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch (err) {
    console.error("Error saving cache:", err);
  }
}

const GEOCODE_DISTACE_ALLOWED = 100;
let addressesCache = loadCache();

export const getAddressFromLocationIQ = async (lat, lng) => {
  // Validate if cache has anything as the limit is quite low and we don't need the gigantig precision this provides
  let address = null;

  for (const address of addressesCache) {
    
    const dist = getDistanceFromCoordinates(lat, lng, parseFloat(address.requestLat), parseFloat(address.requestLng))
    //console.log('address', address.display_name);
    //console.log('le dist is', dist, '->', lat, lng, parseFloat(address.requestLat), parseFloat(address.requestLng));
    if (dist < GEOCODE_DISTACE_ALLOWED) {
      return address;
    }
  }

  // Load new address
  const axios = require('axios');

  let config = {
    method: 'get',
    url: `https://us1.locationiq.com/v1/reverse?key=${env.LOCATIONIQ_TOKEN}&lat=${lat}&lon=${lng}&format=json`,
  };

  try {

    const res = await axios.request(config);
    // console.log('addressData', res.data)
    addressesCache.push({
      ...res.data,
      requestLat: lat,
      requestLng: lng
    })
    address = res.data;
    // save to cache
    saveCache(addressesCache);
    
  } catch (error) {
    console.log(error);
  }

  return address;
}

export const getDistanceFromCoordinates = (lat1, lng1, lat2, lng2) => {
  const R = 6371000, toRad = (x: number) => x * Math.PI / 180;
  const p = toRad(lat2 - lat1), q = toRad(lng2 - lng1);
  const s = Math.sin(p / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(q / 2) ** 2;
  const dist = 2 * R * Math.asin(Math.sqrt(s));
  return dist;
}