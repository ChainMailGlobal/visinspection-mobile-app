import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Button } from 'react-native-paper';

export default function ReportScreen() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Generate Report</Text>
        <Text style={styles.subtitle}>Auto-generated inspection documentation</Text>
      </View>

      <View style={styles.section}>
        <Button mode="contained" style={styles.button}>
          Create PDF Report
        </Button>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Report Includes</Text>
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            • All inspection photos with GPS tags{'\n'}
            • AI-detected discrepancies{'\n'}
            • Code compliance notes{'\n'}
            • Voice-recorded defect marks{'\n'}
            • Professional formatting
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
