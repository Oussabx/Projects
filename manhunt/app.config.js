// Expo config. Google Maps keys are only needed for standalone Android/iOS-Google
// builds — Expo Go works without them.
module.exports = {
  expo: {
    name: 'Manhunt',
    slug: 'manhunt',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'dark',
    backgroundColor: '#0F0F0F',
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#0F0F0F',
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.manhunt.game',
    },
    android: {
      package: 'com.manhunt.game',
      adaptiveIcon: {
        backgroundColor: '#0F0F0F',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION'],
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      'expo-font',
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'Manhunt uses your location to drop pins for the hunters during a game. It is only shared at pin-drop time.',
        },
      ],
      [
        'react-native-maps',
        {
          androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY,
        },
      ],
    ],
  },
};
