import { AccessoryConfig as AccessoryConfigDefault } from 'homebridge';

export type AccessoryConfig = AccessoryConfigDefault | {
    apikey: string;
    latitude: string;
    longitude: string;
};
