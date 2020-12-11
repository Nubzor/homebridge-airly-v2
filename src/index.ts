'use strict';

const AirAccessory = require('./AirAccessory');

module.exports = function (homebridge) {
    homebridge.registerAccessory('Air', AirAccessory);
};