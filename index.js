"use strict";

var Service, Characteristic;
var airService;
var https = require('https');

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory("homebridge-airly", "Air", AirAccessory);
};


/**
 * Air Accessory
 */
function AirAccessory(log, config) {
    this.log = log;

    // Name and API key from airly
    this.name = config['name'];
    this.apikey = config['apikey'];

    // Latitude and longitude
    this.latitude = config['latitude'];
    this.longitude = config['longitude'];


    if (!this.latitude) throw new Error("Airly - you must provide a config value for 'latitude'.");
    if (!this.longitude) throw new Error("Airly - you must provide a config value for 'longitude'.");


    this.lastupdate = 0;
    this.cache = undefined;

    this.log.info("Airly is working");
}


AirAccessory.prototype = {

    /**
     * Get all Air data from airly
     */
    getAirData: function (callback) {
        var self = this;
        var aqi = 0;

        function onError(err) {
            airService.setCharacteristic(Characteristic.StatusFault, 1);
            self.log.error("Airly Network or Unknown Error.");
            callback(err);
        }

        // Make request only every ten minutes
        if (this.lastupdate === 0 || this.lastupdate + 600 < (new Date().getTime() / 1000) || this.cache === undefined) {

            https.get({
                host: 'airapi.airly.eu',
                path: '/v2/measurements/point?lat=' + this.latitude + '&lng=' + this.longitude,
                headers: {
                    'apikey': self.apikey
                },
            }, function(response) {
                if (response.statusCode === 200) {
                    var data = [];

                    response.on('data', function(chunk) {
                        data.push(chunk);
                    })

                    response.on('end', function() {
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
    },


    /**
     * Update data
     */
    updateData: function (data, type) {

        airService.setCharacteristic(Characteristic.StatusFault, 0);

        airService.setCharacteristic(Characteristic.PM2_5Density, data.current.values[1].value);
        airService.setCharacteristic(Characteristic.PM10Density, data.current.values[2].value);

        var aqi = data.current.indexes[0].value;
        this.log.info("[%s] Airly air quality is: %s.", type, aqi.toString());

        this.cache = data;

        if (type === 'Fetch') {
            this.lastupdate = new Date().getTime() / 1000;
        }

        return aqi;
    },


    /**
     * Return Air Quality Index
     * @param aqi
     * @returns {number}
     */
    transformAQI: function (aqi) {
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
    },


    identify: function (callback) {
        this.log("Identify requested!");
        callback(); // success
    },


    getServices: function () {
        var services = [];

        /**
         * Informations
         */
        var informationService = new Service.AccessoryInformation();
        informationService
            .setCharacteristic(Characteristic.Manufacturer, "Airly")
            .setCharacteristic(Characteristic.Model, "API")
            .setCharacteristic(Characteristic.SerialNumber, "123-456");
        services.push(informationService);

        /**
         * AirService
         */
        airService = new Service.AirQualitySensor(this.name);

        airService
            .getCharacteristic(Characteristic.AirQuality)
            .on('get', this.getAirData.bind(this));

        airService.addCharacteristic(Characteristic.StatusFault);
        airService.addCharacteristic(Characteristic.PM2_5Density);
        airService.addCharacteristic(Characteristic.PM10Density);
        services.push(airService);


        return services;
    }
};

