import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';

export interface EventMapProps {
  latitude: number;
  longitude: number;
  title: string;
  description?: string;
}

/**
 * Web mapa — Leaflet + Carto dark/light tiles (bez API klíče).
 */
export default function EventMap({
  latitude,
  longitude,
  title,
}: EventMapProps) {
  const scheme = useColorScheme() ?? 'light';
  const isDark = scheme === 'dark';

  const srcDoc = useMemo(() => {
    const tileUrl = isDark
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    const bg = isDark ? '#121416' : '#F2F2F7';
    const safeTitle = String(title || '')
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/</g, '');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { margin: 0; height: 100%; width: 100%; background: ${bg}; }
    .leaflet-control-attribution { font-size: 9px !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
  <script>
    var map = L.map('map', { zoomControl: false, attributionControl: true })
      .setView([${latitude}, ${longitude}], 15);
    L.tileLayer('${tileUrl}', {
      maxZoom: 19,
      subdomains: 'abcd',
      attribution: '&copy; OSM &copy; CARTO'
    }).addTo(map);
    var icon = L.divIcon({
      className: '',
      html: '<div style="width:18px;height:18px;border-radius:50% 50% 50% 0;background:#4175E1;transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45)"></div>',
      iconSize: [18, 18],
      iconAnchor: [9, 18]
    });
    L.marker([${latitude}, ${longitude}], { icon: icon, title: '${safeTitle}' }).addTo(map);
  <\/script>
</body>
</html>`;
  }, [latitude, longitude, title, isDark]);

  return (
    <View style={[styles.wrap, { backgroundColor: isDark ? '#121416' : '#F2F2F7' }]}>
      <iframe
        srcDoc={srcDoc}
        width="100%"
        height="100%"
        style={{ border: 0 }}
        allowFullScreen={false}
        loading="lazy"
        title={title}
        referrerPolicy="no-referrer-when-downgrade"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    height: 200,
    overflow: 'hidden',
  },
});
