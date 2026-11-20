export type WeatherAlertLevel = 'ATTENTION' | 'ALERT' | 'EMERGENCY';

export interface WeatherAlert {
    id: string;
    level: WeatherAlertLevel;
    title: string;
    message: string;
    regionLabel: string;
    issuedAt: string;
    expiresAt: string;
    simulated: true;
}
