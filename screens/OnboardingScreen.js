import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Button } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';

const ONBOARDING_KEY = 'hasSeenOnboarding';

export default function OnboardingScreen({ navigation }) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const slides = [
    {
      title: 'Build Right As You Go',
      subtitle: 'Prevent costly rework with AI-powered inspections',
      features: [
        { label: 'FORESIGHT', description: 'Upload building plans and get AI analysis of code violations before starting work' },
        { label: 'EYESIGHT (Live AI)', description: 'Real-time mobile camera inspection with AI violation detection and voice narration' },
        { label: 'HINDSIGHT', description: 'Post-construction compliance documentation (Coming Soon)' },
      ],
      valueNote: 'One prevented rework pays for the platform',
    },
    {
      title: 'Powerful AI Inspection Tools',
      subtitle: 'Catch issues before they become costly problems',
      features: [
        { label: 'Smart Photo Analysis', description: 'AI detects code violations, structural issues, and safety hazards in real-time' },
        { label: 'Voice Narration', description: 'Hear violations called out hands-free while you work' },
        { label: 'Detailed PDF Reports', description: 'Generate professional inspection reports with photos, GPS coordinates, and violations' },
      ],
      valueNote: 'Designed for contractors who want to get it right the first time',
    },
    {
      title: 'Ready to Get Started?',
      subtitle: 'Join construction teams preventing inspection issues',
      isAuthScreen: true,
    },
  ];

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setCurrentSlide(currentSlide + 1);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      });
    }
  };

  const handleSkip = () => {
    handleContinueAsGuest();
  };

  const handleContinueAsGuest = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
      await AsyncStorage.setItem('authMode', 'guest');
      Speech.speak('Welcome to VISION. Build right as you go with AR-powered jobsite verification.');
      navigation.replace('Home');
    } catch (error) {
      console.error('Failed to save onboarding state:', error);
      navigation.replace('Home');
    }
  };

  const handleSignUp = () => {
    navigation.replace('Auth', { mode: 'signup' });
  };

  const handleLogin = () => {
    navigation.replace('Auth', { mode: 'login' });
  };

  const slide = slides[currentSlide];

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {!slide.isAuthScreen ? (
          <>
            <View style={styles.header}>
              <Text style={styles.title}>{slide.title}</Text>
              <Text style={styles.subtitle}>{slide.subtitle}</Text>
            </View>

            <View style={styles.featuresContainer}>
              {slide.features.map((feature, index) => (
                <View key={index} style={styles.featureCard}>
                  <View style={styles.featureHeader}>
                    <View style={styles.featureBullet} />
                    <Text style={styles.featureLabel}>{feature.label}</Text>
                  </View>
                  <Text style={styles.featureDescription}>{feature.description}</Text>
                </View>
              ))}
            </View>

            <View style={styles.valueContainer}>
              <Text style={styles.valueText}>{slide.valueNote}</Text>
            </View>
          </>
        ) : (
          <>
            <View style={styles.header}>
              <Text style={styles.title}>{slide.title}</Text>
              <Text style={styles.subtitle}>{slide.subtitle}</Text>
            </View>

            <View style={styles.authContainer}>
              <TouchableOpacity
                style={styles.authCardPrimary}
                onPress={handleContinueAsGuest}
                activeOpacity={0.8}
              >
                <Text style={styles.authTitle}>Start Beta Testing</Text>
                <Text style={styles.authDescription}>
                  Begin using VISION immediately{'\n'}
                  No account required
                </Text>
                <View style={styles.recommendedBadge}>
                  <Text style={styles.recommendedText}>RECOMMENDED</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.authCardSecondary}
                onPress={handleSignUp}
                activeOpacity={0.8}
              >
                <Text style={styles.authTitleSecondary}>Create Account</Text>
                <Text style={styles.authDescriptionSecondary}>
                  Save inspection data across devices{'\n'}
                  Full cloud sync and backup
                </Text>
                <View style={styles.comingSoonBadge}>
                  <Text style={styles.comingSoonText}>COMING SOON</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleLogin} style={styles.loginLink}>
                <Text style={styles.loginText}>Already have an account? Sign In</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        <View style={styles.dotsContainer}>
          {slides.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === currentSlide && styles.activeDot,
              ]}
            />
          ))}
        </View>
      </Animated.View>

      {!slide.isAuthScreen && (
        <View style={styles.footer}>
          <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>

          <Button
            mode="contained"
            onPress={handleNext}
            style={styles.nextButton}
            labelStyle={styles.nextButtonLabel}
          >
            Next
          </Button>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 22,
  },
  featuresContainer: {
    marginBottom: 32,
  },
  featureCard: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  featureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0066CC',
    marginRight: 12,
  },
  featureLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  featureDescription: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
    marginLeft: 20,
  },
  valueContainer: {
    backgroundColor: '#F0F7FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#0066CC',
  },
  valueText: {
    fontSize: 14,
    color: '#0066CC',
    textAlign: 'center',
    fontWeight: '500',
  },
  authContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  authCardPrimary: {
    backgroundColor: '#0066CC',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    alignItems: 'center',
  },
  authCardSecondary: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    alignItems: 'center',
  },
  authTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  authDescription: {
    fontSize: 14,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 20,
    opacity: 0.9,
  },
  authTitleSecondary: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  authDescriptionSecondary: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 20,
  },
  recommendedBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 12,
  },
  recommendedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0066CC',
    letterSpacing: 0.5,
  },
  comingSoonBadge: {
    backgroundColor: '#F8F8F8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  comingSoonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#999999',
    letterSpacing: 0.5,
  },
  loginLink: {
    marginTop: 8,
    padding: 12,
    alignItems: 'center',
  },
  loginText: {
    fontSize: 14,
    color: '#0066CC',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5E5E5',
    marginHorizontal: 4,
  },
  activeDot: {
    width: 24,
    backgroundColor: '#0066CC',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 20,
  },
  skipButton: {
    padding: 12,
  },
  skipText: {
    fontSize: 16,
    color: '#999999',
  },
  nextButton: {
    backgroundColor: '#0066CC',
    paddingHorizontal: 32,
  },
  nextButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
});
