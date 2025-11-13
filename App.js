import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { Provider as PaperProvider, DefaultTheme } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';

import OnboardingScreen from './screens/OnboardingScreen';
import AuthScreen from './screens/AuthScreen';
import HomeScreen from './screens/HomeScreen';
import LiveInspectionScreen from './screens/LiveInspectionScreen';
import ReportScreen from './screens/ReportScreen';
import MaterialIdentificationScreen from './screens/MaterialIdentificationScreen';
import BuildingCodesScreen from './screens/BuildingCodesScreen';
import ProjectsScreen from './screens/ProjectsScreen';

const Stack = createStackNavigator();

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#000000',
    accent: '#0066CC',
    background: '#FFFFFF',
    surface: '#F5F5F5',
    text: '#1A1A1A',
  },
};

const APP_VERSION = '1.0.0'; // Update this when you want to force onboarding

export default function App() {
  const [initialRoute, setInitialRoute] = useState(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const [hasSeenOnboarding, lastVersion] = await Promise.all([
          AsyncStorage.getItem('hasSeenOnboarding'),
          AsyncStorage.getItem('appVersion')
        ]);

        // Force onboarding if version changed or first install
        if (lastVersion !== APP_VERSION) {
          await AsyncStorage.setItem('appVersion', APP_VERSION);
          setInitialRoute('Onboarding');
        } else if (hasSeenOnboarding === 'true') {
          setInitialRoute('Home');
        } else {
          setInitialRoute('Onboarding');
        }
      } catch (error) {
        console.error('Error checking onboarding:', error);
        setInitialRoute('Onboarding');
      } finally {
        setIsReady(true);
      }
    };

    checkOnboarding();
  }, []);

  if (!isReady) {
    return null; // Or a splash screen component
  }

  return (
    <PaperProvider theme={theme}>
      <NavigationContainer>
        <StatusBar style="auto" />
        <Stack.Navigator initialRouteName={initialRoute}>
          <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'VIS Eyesight' }} />
          <Stack.Screen name="LiveInspection" component={LiveInspectionScreen} options={{ headerShown: false, title: 'Live AI Inspection' }} />
          <Stack.Screen name="Report" component={ReportScreen} />
          <Stack.Screen name="MaterialIdentification" component={MaterialIdentificationScreen} />
          <Stack.Screen name="BuildingCodes" component={BuildingCodesScreen} />
          <Stack.Screen name="Projects" component={ProjectsScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>
  );
}
