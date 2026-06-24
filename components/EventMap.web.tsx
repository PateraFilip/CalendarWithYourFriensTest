import React from 'react';
import { View } from 'react-native';

export interface EventMapProps {
    latitude: number;
    longitude: number;
    title: string;
    description?: string;
}

export default function EventMap({ latitude, longitude, title, description }: EventMapProps) {
    // Použijeme jednoduchý iframe z Google Maps pro zobrazení polohy
    // Je to zdarma a nevyžaduje API klíč pro základní zobrazení
    const mapUrl = `https://maps.google.com/maps?q=${latitude},${longitude}&t=&z=15&ie=UTF8&iwloc=&output=embed`;

    return (
        <View style={{ width: '100%', height: 200, overflow: 'hidden' }}>
            <iframe 
                src={mapUrl}
                width="100%" 
                height="100%" 
                style={{ border: 0 }} 
                allowFullScreen={false} 
                loading="lazy" 
                referrerPolicy="no-referrer-when-downgrade"
            />
        </View>
    );
}
