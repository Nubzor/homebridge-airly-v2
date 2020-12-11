import fs from 'fs';
import path from 'path';

import Airly from '../src/Airly';

describe('Checking Airly response', () => {
    const airly = new Airly('randomApiKey');

    test('Valid JSON as it should not throw', () => {
        expect.assertions(1);

        const msg = fs.createReadStream(path.resolve(__dirname, './AirlyResponse.js'), { highWaterMark: 8 })

        // @ts-ignore
        return expect(airly.onResponse(msg)).resolves.toBeInstanceOf(Object);
    });
})