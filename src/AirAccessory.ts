import { AccessoryPlugin, AccessoryConfig, API, Characteristic, Logging, Service } from 'homebridge';

import { AirlyResponse } from '../types/AirlyResponse';

import Airly from './Airly';

export default class AirAccessory implements AccessoryPlugin {
    private readonly Service: typeof Service = this.api.hap.Service;
    private readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;
    
    private airService: Service | null = null;

    private mandatoryConfigKeys: Array<string> = ['name', 'apikey', 'latitude', 'longitude'];

    private name: string = "";
    private latitude: string = "";
    private longitude: string = "" ;

    private lastUpdate: number = 0;
    private cache: AirlyResponse | null = null;

    private Airly: Airly;

    constructor(
        private readonly log: Logging, 
        private readonly config: AccessoryConfig,
        private readonly api: API) {

        this.verifyConfig(config);
        this.assignConfigKeysToClassProperties(config);

        this.Airly = new Airly(config['apikey']);

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
            this.Airly.getMeasurements(this.latitude, this.longitude)
                .then(response => {
                    aqi = self.updateData(response, 'Fetch');

                    callback(null, this.Airly.transformAQI(aqi));
                }).catch(onError);
        } else {
            aqi = self.updateData(self.cache, 'Cache');
            callback(null, this.Airly.transformAQI(aqi));
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

        this.cache = data;

        if (type === 'Fetch') {
            this.lastUpdate = new Date().getTime() / 1000;
        }

        return aqi;
    }

    identify(): void {
        this.log('Identify requested!');
    }

    getServices(): Service[] {    
        return [
            this.prepareInformationService(),
            this.prepareAirService(),
        ];
    }

    prepareInformationService(): Service {
        const informationService = new this.Service.AccessoryInformation();

        informationService
            .setCharacteristic(this.Characteristic.Manufacturer, 'Airly')
            .setCharacteristic(this.Characteristic.Model, 'API')
            .setCharacteristic(this.Characteristic.SerialNumber, '123-456');

        return informationService;
    }

    prepareAirService(): Service {
        this.airService = new this.Service.AirQualitySensor(this.name);

        this.airService
            .getCharacteristic(this.Characteristic.AirQuality)
            .on('get', this.getAirData.bind(this));

        this.airService.addCharacteristic(this.Characteristic.StatusFault);
        this.airService.addCharacteristic(this.Characteristic.PM2_5Density);
        this.airService.addCharacteristic(this.Characteristic.PM10Density);

        return this.airService;
    }
}