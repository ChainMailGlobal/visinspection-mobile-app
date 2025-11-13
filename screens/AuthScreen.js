import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Button } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function AuthScreen({ navigation, route }) {
  const mode = route?.params?.mode || 'login';

  const handleGuestMode = async () => {
    try {
      await AsyncStorage.setItem('hasSeenOnboarding', 'true');
      await AsyncStorage.setItem('authMode', 'guest');
      navigation.replace('Home');
    } catch (error) {
      console.error('Failed to save guest mode:', error);
      // Still navigate even if storage fails
      navigation.replace('Home');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {mode === 'signup' ? 'Create Account' : 'Sign In'}
      </Text>
      <Text style={styles.subtitle}>
        Full authentication with cloud sync coming soon
      </Text>
      <Button
        mode="contained"
        onPress={handleGuestMode}
        style={styles.button}
      >
        Continue as Guest
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 24,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#0066CC',
  },
});
