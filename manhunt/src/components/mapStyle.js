// Google Maps (Android) night style tuned to the Manhunt palette.
// iOS uses Apple Maps with userInterfaceStyle="dark".
export const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#151515' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#7a7a7a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#151515' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#2a2a2a' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1b2119' }, { visibility: 'on' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2c2c2c' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1c1c1c' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3a3a3a' }] },
  { featureType: 'road.arterial', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0b0b0b' }] },
];
