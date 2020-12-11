export type AirlyResponse = {
    current: {
        fromDateTime: string;
        tillDateTime: string;
        values: Array<{
            name: string;
            value: number;
        }>;
        indexes: Array<{
            name: string;
            value: number;
            level: string;
            description: string;
            advice: string;
            color: string;
        }>
    };
    history: any;
    forecast: any;
}