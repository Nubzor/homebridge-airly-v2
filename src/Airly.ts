import https from 'https';
import http from 'http';

import { AirlyResponse } from '../types/AirlyResponse';

import AirQualiltySensorValues from './enums/AirQualiltySensorValues';

export default class Airly {
    constructor(private readonly apiKey: string) {}

    getMeasurements(latitude: string, longitude: string) {
        return new Promise<AirlyResponse>((resolve, reject) => {
            https.get({
                host: 'airapi.airly.eu',
                path: '/v2/measurements/point?lat=' + latitude + '&lng=' + longitude, 
                headers: {
                    'apikey': this.apiKey,
                },
            }, (response: http.IncomingMessage) => {
                if (response.statusCode === 200) {
                    this.onResponse(response)
                        .then(resolve)
                        .catch(reject);
                } else {
                    reject('Status code different than 200 - ' + response.statusCode);
                }
            }).on('error', (err) => {
                reject(err);
            });
        })
    }

    onResponse(response: http.IncomingMessage) {
        return new Promise<AirlyResponse>((resolve, reject) => {
            const data : Array<string> = [];

            response.on('data', (chunk: string) => {
                data.push(chunk);
            })

            response.on('end', () => {
                try {
                    const _response: AirlyResponse = JSON.parse(data.join(''));

                    resolve(_response);
                } catch (e) {
                    reject(e);
                }
            });
        })
    }

    transformAQI(aqi: number): number {
        if (!aqi) {
            return AirQualiltySensorValues.UNKNOWN;
        } else if (aqi <= 25) {
            return AirQualiltySensorValues.EXCELLENT;
        } else if (aqi > 25 && aqi <= 50) {
            return AirQualiltySensorValues.GOOD;
        } else if (aqi > 50 && aqi <= 75) {
            return AirQualiltySensorValues.FAIR;
        } else if (aqi > 75 && aqi <= 100) {
            return AirQualiltySensorValues.INFERIOR;
        } else if (aqi > 100) {
            return AirQualiltySensorValues.POOR;
        } else {
            return AirQualiltySensorValues.UNKNOWN;
        }
    }
}