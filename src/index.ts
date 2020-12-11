import { API } from 'homebridge';

import AirAccessory from './AirAccessory';

module.exports = function (homebridge: API) {
    homebridge.registerAccessory('Air', AirAccessory);
};