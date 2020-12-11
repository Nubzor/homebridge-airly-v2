// @ts-nocheck
// temporary

const https = require('https');

module.exports = class AirAccessory {
    constructor(log, config, api) {
        this.log = log;

        this.service = api.hap.Service;
        this.characteristic = api.hap.Characteristic;

        this.airService;

        // Name and API key from airly
        this.name = config['name'];
        this.apikey = config['apikey'];

        // Latitude and longitude
        this.latitude = config['latitude'];
        this.longitude = config['longitude'];


        if (!this.latitude) {
            throw new Error('Airly - you must provide a config value for \'latitude\'.');
        }
        if (!this.longitude) {
            throw new Error('Airly - you must provide a config value for \'longitude\'.');
        }


        this.lastupdate = 0;
        this.cache = undefined;

        this.log.info('Airly is working');
    }

    getAirData(callback) {
        var self = this;
        var aqi = 0;

        function onError(err) {
            self.airService.setCharacteristic(this.characteristic.StatusFault, 1);
            self.log.error('Airly Network or Unknown Error.');
            callback(err);
        }

        // Make request only every ten minutes
        if (this.lastupdate === 0 || this.lastupdate + 600 < (new Date().getTime() / 1000) || this.cache === undefined) {

            https.get({
                host: 'airapi.airly.eu',
                path: '/v2/measurements/point?lat=' + this.latitude + '&lng=' + this.longitude,
                headers: {
                    'apikey': self.apikey,
                },
            }, (response) => {
                if (response.statusCode === 200) {
                    var data = [];

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

        this.airService.setCharacteristic(this.characteristic.StatusFault, 0);

        this.airService.setCharacteristic(this.characteristic.PM2_5Density, data.current.values[1].value);
        this.airService.setCharacteristic(this.characteristic.PM10Density, data.current.values[2].value);

        var aqi = data.current.indexes[0].value;
        this.log.info('[%s] Airly air quality is: %s.', type, aqi.toString());

        this.cache = data;

        if (type === 'Fetch') {
            this.lastupdate = new Date().getTime() / 1000;
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
            return (0); // Error or unknown response
        } else if (aqi <= 25) {
            return (1); // Return EXCELLENT
        } else if (aqi > 25 && aqi <= 50) {
            return (2); // Return GOOD
        } else if (aqi > 50 && aqi <= 75) {
            return (3); // Return FAIR
        } else if (aqi > 75 && aqi <= 100) {
            return (4); // Return INFERIOR
        } else if (aqi > 100) {
            return (5); // Return POOR (Homekit only goes to cat 5, so combined the last two AQI cats of Very Unhealty and Hazardous.
        } else {
            return (0); // Error or unknown response.
        }
    }

    identify(callback) {
        this.log('Identify requested!');
        callback(); // success
    }

    getServices() {
        var services = [];

        /**
         * Informations
         */
        var informationService = new this.service.AccessoryInformation();
        informationService
            .setCharacteristic(this.characteristic.Manufacturer, 'Airly')
            .setCharacteristic(this.characteristic.Model, 'API')
            .setCharacteristic(this.characteristic.SerialNumber, '123-456');
        services.push(informationService);

        /**
         * AirService
         */
        this.airService = new this.service.AirQualitySensor(this.name);

        this.airService
            .getCharacteristic(this.characteristic.AirQuality)
            .on('get', this.getAirData.bind(this));

        this.airService.addCharacteristic(this.characteristic.StatusFault);
        this.airService.addCharacteristic(this.characteristic.PM2_5Density);
        this.airService.addCharacteristic(this.characteristic.PM10Density);

        services.push(this.airService);
    
        return services;
    }
}