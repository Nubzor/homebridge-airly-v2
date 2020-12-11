import { API } from 'homebridge';

import AirAccessory from './AirAccessory';

export = (api: API) => {
    api.registerAccessory('Air', AirAccessory);
};