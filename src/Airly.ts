import https from 'https';

import { AirlyResponse } from '../types/AirlyResponse';
import AirAccessory from './AirAccessory';

export default class Airly {
    constructor(private readonly apiKey) {

    }

    getMeasurements(latitude: string, longitude: string) {
        return new Promise((resolve, reject) => {
            https.get({
                host: 'airapi.airly.eu',
                path: '/v2/measurements/point?lat=' + latitude + '&lng=' + longitude, 
                headers: {
                    'apikey': this.apiKey,
                },
            }, (response) => {
                if (response.statusCode === 200) {
                    this.onResponse(response, resolve, reject);
                } else {
                    reject('Status code different than 200 - ' + response.statusCode);
                }
            }).on('error', (err) => {
                reject(err);
            });
        })
    }

    onResponse(response, resolve, reject) {   
        const data : Array<string> = [];

        response.on('data', (chunk: string) => {
            data.push(chunk);
        })

        response.on('end', () => {
            try {
                const _response: AirlyResponse = JSON.parse(data.join());

                resolve(_response);
            } catch (e) {
                reject(e);
            }
        });
    }

    transformAQI(aqi: number): number {
        if (!aqi) {
            return 0; // Error or unknown response
        } else if (aqi <= 25) {
            return 1; // Return EXCELLENT
        } else if (aqi > 25 && aqi <= 50) {
            return 2; // Return GOOD
        } else if (aqi > 50 && aqi <= 75) {
            return 3; // Return FAIR
        } else if (aqi > 75 && aqi <= 100) {
            return 4; // Return INFERIOR
        } else if (aqi > 100) {
            return 5; // Return POOR (Homekit only goes to cat 5, so combined the last two AQI cats of Very Unhealty and Hazardous.
        } else {
            return 0; // Error or unknown response.
        }
    }
}