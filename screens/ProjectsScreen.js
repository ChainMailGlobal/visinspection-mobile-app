import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { FAB } from 'react-native-paper';

export default function ProjectsScreen({ navigation }) {
  const [projects] = useState([
    { id: 1, name: 'Sample Project', address: '123 Main St', date: '2025-11-09' },
  ]);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {projects.map((project) => (
          <TouchableOpacity key={project.id} style={styles.projectCard}>
            <Text style={styles.projectName}>{project.name}</Text>
            <Text style={styles.projectAddress}>{project.address}</Text>
            <Text style={styles.projectDate}>{project.date}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FAB
        style={styles.fab}
        label="New Project"
        onPress={() => navigation.navigate('Inspection')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  projectCard: {
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  projectName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  projectAddress: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  projectDate: {
    fontSize: 12,
    color: '#999999',
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#0066CC',
  },
});
