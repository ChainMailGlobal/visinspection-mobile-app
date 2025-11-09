import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Button } from 'react-native-paper';

export default function MaterialIdentificationScreen() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Material Identification</Text>
        <Text style={styles.subtitle}>AI-powered material analysis</Text>
      </View>

      <View style={styles.section}>
        <Button mode="contained" icon="camera" style={styles.button}>
          Scan Material
        </Button>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>How It Works</Text>
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            • Take a photo of the material{'\n'}
            • AI identifies material type{'\n'}
            • Get code compliance info{'\n'}
            • Access installation guidelines
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    padding: 24,
    backgroundColor: '#F8F8F8',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#0066CC',
  },
  infoCard: {
    backgroundColor: '#F0F7FF',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#0066CC',
  },
  infoText: {
    fontSize: 14,
    color: '#0066CC',
    lineHeight: 24,
  },
});
