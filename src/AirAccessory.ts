import { AccessoryPlugin, API, Characteristic, Logging, Service } from 'homebridge';

import { AirlyResponse } from '../types/AirlyResponse';
import { AccessoryConfig } from '../types/AccessoryConfig';

import FetchModes from './enums/FetchModes';

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

        // @ts-ignore
        this.Airly = new Airly(config.apikey);

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

    getAirData(callback: Function) {
        const self = this;
        let aqi = 0;

        function onError(err: Error) {
            if (self.airService !== null) {
                self.airService.setCharacteristic(self.Characteristic.StatusFault, 1);
            }

            self.log.error('Airly Network or Unknown Error.');
            callback(err);
        }

        // Make request only every ten minutes
        if (this.cache === null || this.lastUpdate === 0 || this.lastUpdate + 600 < (new Date().getTime() / 1000)) {
            this.Airly.getMeasurements(this.latitude, this.longitude)
                .then(response => {
                    aqi = self.updateData(response, FetchModes.FETCH);

                    callback(null, this.Airly.transformAQI(aqi));
                }).catch(onError);
        } else {
            aqi = self.updateData(this.cache, FetchModes.CACHE);

            callback(null, this.Airly.transformAQI(aqi));
        }
    }

    updateData(data: AirlyResponse, type: string): number {
        this.setAirCharacteristics(data);

        var aqi = data.current.indexes[0].value;
        this.log.info('[%s] Airly air quality is: %s.', type, aqi.toString());

        this.cache = data;

        if (type === FetchModes.FETCH) {
            this.lastUpdate = new Date().getTime() / 1000;
        }

        return aqi;
    }

    setAirCharacteristics(data: AirlyResponse) {
        const characteristics : Array<{
            name: string;
            type: typeof Characteristic;
        }> = [
            { name: 'PM25', type: this.Characteristic.PM2_5Density },
            { name: 'PM10', type: this.Characteristic.PM10Density },
        ];

        if (this.airService === null) {
            this.log.error('AirQualiltySensor is null - probably has not been initialized');

            return 0;
        }

        characteristics.forEach((characteristic) => {
            const item = data.current.values.find(value => {
                return value.name === characteristic.name;
            })

            if (item) {
                // @ts-ignore
                this.airService.setCharacteristic(characteristic.type, item.value);
            }
        });

        this.airService.setCharacteristic(this.Characteristic.StatusFault, 0);
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