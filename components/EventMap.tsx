import React from 'react';
import { Platform, View, Text } from 'react-native';

export interface EventMapProps {
    latitude: number;
    longitude: number;
    title: string;
    description?: string;
}

export default function EventMap({ latitude, longitude, title, description }: EventMapProps) {
    if (Platform.OS === 'web') {
        const bbox = `${longitude - 0.005},${latitude - 0.005},${longitude + 0.005},${latitude + 0.005}`;
        const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude},${longitude}`;
        return (
            <div style={{ width: '100%', height: 200, backgroundColor: '#f0f0f0' }}>
                <iframe
                    width="100%"
                    height="100%"
                    frameBorder="0"
                    scrolling="no"
                    src={src}
                    title={title}
                />
            </div>
        );
    }

    // Nativní import (provede se bezpečně pouze na Android/iOS za běhu, 
    // ale nesmí to shodit Metro bundler. Raději to zkusíme nativně s normálním importem.
    // Expo Router zvládá ignorovat view z react-native-maps, pokud se do něj na webu nevleze)
    const MapView = require('react-native-maps').default;
    const { Marker, PROVIDER_GOOGLE } = require('react-native-maps');

    return (
        <MapView 
            provider={PROVIDER_GOOGLE} 
            style={{ width: '100%', height: 200 }} 
            initialRegion={{ 
                latitude, 
                longitude, 
                latitudeDelta: 0.005, 
                longitudeDelta: 0.005 
            }}
        >
            <Marker 
                coordinate={{ latitude, longitude }} 
                title={title} 
                description={description} 
            />
        </MapView>
    );
}
