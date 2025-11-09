import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { TextInput, Button } from 'react-native-paper';

export default function BuildingCodesScreen() {
  const [jurisdiction, setJurisdiction] = useState('');
  const [projectType, setProjectType] = useState('');

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Foresight</Text>
        <Text style={styles.subtitle}>Pre-submission plan validation</Text>
      </View>

      <View style={styles.section}>
        <TextInput
          label="Jurisdiction"
          value={jurisdiction}
          onChangeText={setJurisdiction}
          mode="outlined"
          placeholder="e.g., Los Angeles, CA"
          style={styles.input}
          outlineColor="#E5E5E5"
          activeOutlineColor="#0066CC"
        />

        <TextInput
          label="Project Type"
          value={projectType}
          onChangeText={setProjectType}
          mode="outlined"
          placeholder="e.g., Residential, Commercial"
          style={styles.input}
          outlineColor="#E5E5E5"
          activeOutlineColor="#0066CC"
        />

        <Button mode="contained" style={styles.button}>
          Check Building Codes
        </Button>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>How It Works</Text>
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            • Upload construction plans{'\n'}
            • AI validates against local building codes{'\n'}
            • Get pre-submission compliance report{'\n'}
            • Catch issues before they become costly rework
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
  input: {
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  button: {
    backgroundColor: '#0066CC',
    marginTop: 8,
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
