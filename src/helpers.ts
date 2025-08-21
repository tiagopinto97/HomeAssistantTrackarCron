const xml2js = require('xml2js');

export const getDistanceFromCoordinates = (lat1, lng1, lat2, lng2)  => {
  const R = 6371000, toRad = (x: number) => x * Math.PI / 180;
  const p = toRad(lat2 - lat1), q = toRad(lng2 - lng1);
  const s = Math.sin(p / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(q / 2) ** 2;
  const dist = 2 * R * Math.asin(Math.sqrt(s));
  return dist;
}


/**
 * Function used to validate if a given timestamp is within the last 24h
 * 
 * @param timestamp timestamp to check
 * @returns if the timestamp is within desired timeline
 */
export function isTimestampWithinLast24h(timestamp: string): boolean {
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
export function xmlToJs(xml) {
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
export async function extractJsonObject(xmlString) {
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
export const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

