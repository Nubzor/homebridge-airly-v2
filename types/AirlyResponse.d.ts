export type AirlyResponse = {
    current: {
        fromDateTime: string;
        tillDateTime: string;
        values: Array<{
            name: string;
            value: number;
        }>
    };
    history: any;
    forecast: any;
}