import { AccessoryPlugin, AccessoryConfig, API, Characteristic, Logging, Service } from 'homebridge';

import https from 'https';

export default class AirAccessory implements AccessoryPlugin {
    private readonly Service: typeof Service = this.api.hap.Service;
    private readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;
    
    private airService: Service | null = null;

    private mandatoryConfigKeys: Array<string> = ['name', 'apikey', 'latitude', 'longitude'];

    private lastUpdate: number;
    private cache: any;
    latitude: string = "";
    longitude: string = "" ;
    apikey: string | number | string[] | undefined;
    name: string | undefined;

    constructor(
        private readonly log: Logging, 
        private readonly config: AccessoryConfig,
        private readonly api: API) {

        this.verifyConfig(config);
        this.assignConfigKeysToClassProperties(config);

        this.lastUpdate = 0;
        this.cache = undefined;

        this.log.info('Airly is working');
    }

    verifyConfig(config: AccessoryConfig) {
        this.mandatoryConfigKeys.forEach((key: string) => {
            if (!config[key]) {
                throw new Error(`Airly - you must provide a config value for ${key}.`)
            }
        })
    }

    assignConfigKeysToClassProperties(config: AccessoryConfig) {
        this.mandatoryConfigKeys.forEach((key: string) => {
            this[key] = config[key];
        })
    }

    getAirData(callback) {
        var self = this;
        var aqi = 0;

        function onError(err) {
            if (self.airService !== null) {
                self.airService.setCharacteristic(self.Characteristic.StatusFault, 1);
            }

            self.log.error('Airly Network or Unknown Error.');
            callback(err);
        }

        // Make request only every ten minutes
        if (this.lastUpdate === 0 || this.lastUpdate + 600 < (new Date().getTime() / 1000) || this.cache === undefined) {

            https.get({
                host: 'airapi.airly.eu',
                path: '/v2/measurements/point?lat=' + this.latitude + '&lng=' + this.longitude, 
                headers: {
                    'apikey': self.apikey,
                },
            }, (response) => {
                if (response.statusCode === 200) {
                    var data : Array<any> = [];

                    response.on('data', (chunk) => {
                        data.push(chunk);
                    })

                    response.on('end', () => {
                        try {
                            var _response = JSON.parse(data.join());

                            aqi = self.updateData(_response, 'Fetch');
                            callback(null, self.transformAQI(aqi));
                        } catch (e) {
                            onError(e);
                        }
                    });
                } else {
                    onError('Status code different than 200 - ' + response.statusCode);
                }
            }).on('error', onError);

            // Return cached data
        } else {
            aqi = self.updateData(self.cache, 'Cache');
            callback(null, self.transformAQI(aqi));
        }
    }

    updateData(data, type) {
        if (this.airService === null) {
            this.log.error('AirQualiltySensor is null - probably has not been initialized');
            return;
        }

        this.airService.setCharacteristic(this.Characteristic.StatusFault, 0);

        this.airService.setCharacteristic(this.Characteristic.PM2_5Density, data.current.values[1].value);
        this.airService.setCharacteristic(this.Characteristic.PM10Density, data.current.values[2].value);

        var aqi = data.current.indexes[0].value;
        this.log.info('[%s] Airly air quality is: %s.', type, aqi.toString());
console.log(data);
        this.cache = data;

        if (type === 'Fetch') {
            this.lastUpdate = new Date().getTime() / 1000;
        }

        return aqi;
    }

    /**
     * Return Air Quality Index
     * @param aqi
     * @returns {number}
     */
    transformAQI(aqi) {
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

    identify(): void {
        this.log('Identify requested!');
    }

    getServices(): Service[] {
        /**
         * Informations
         */
        const informationService = new this.Service.AccessoryInformation();

        informationService
            .setCharacteristic(this.Characteristic.Manufacturer, 'Airly')
            .setCharacteristic(this.Characteristic.Model, 'API')
            .setCharacteristic(this.Characteristic.SerialNumber, '123-456');

        /**
         * AirService
         */
        this.airService = new this.Service.AirQualitySensor(this.name);

        this.airService
            .getCharacteristic(this.Characteristic.AirQuality)
            .on('get', this.getAirData.bind(this));

        this.airService.addCharacteristic(this.Characteristic.StatusFault);
        this.airService.addCharacteristic(this.Characteristic.PM2_5Density);
        this.airService.addCharacteristic(this.Characteristic.PM10Density);
    
        return [informationService, this.airService];
    }
}