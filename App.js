import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { Provider as PaperProvider, DefaultTheme } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';

import OnboardingScreen from './screens/OnboardingScreen';
import AuthScreen from './screens/AuthScreen';
import HomeScreen from './screens/HomeScreen';
import InspectionScreen from './screens/InspectionScreen';
import RealtimeInspectionScreen from './screens/RealtimeInspectionScreen';
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

export default function App() {
  const [initialRoute, setInitialRoute] = useState('Onboarding');

  useEffect(() => {
    AsyncStorage.getItem('hasSeenOnboarding')
      .then(seen => setInitialRoute(seen === 'true' ? 'Home' : 'Onboarding'))
      .catch(() => setInitialRoute('Onboarding'));
  }, []);

  return (
    <PaperProvider theme={theme}>
      <NavigationContainer>
        <StatusBar style="auto" />
        <Stack.Navigator initialRouteName={initialRoute}>
          <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'VIS Eyesight' }} />
          <Stack.Screen name="Inspection" component={InspectionScreen} options={{ title: 'Classic Mode' }} />
          <Stack.Screen name="RealtimeInspection" component={RealtimeInspectionScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Report" component={ReportScreen} />
          <Stack.Screen name="MaterialIdentification" component={MaterialIdentificationScreen} />
          <Stack.Screen name="BuildingCodes" component={BuildingCodesScreen} />
          <Stack.Screen name="Projects" component={ProjectsScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>
  );
}
