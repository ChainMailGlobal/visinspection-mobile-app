import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Alert, ActivityIndicator } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/env';
import { MaterialIcons } from '@expo/vector-icons';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function ProjectsScreen({ navigation }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProject, setNewProject] = useState({
    name: '',
    address: '',
    project_type: 'residential',
  });

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        console.log('No authenticated user');
        setProjects([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching projects:', error);
        Alert.alert('Error', 'Failed to load projects');
      } else {
        setProjects(data || []);
      }
    } catch (error) {
      console.error('Fetch projects error:', error);
    } finally {
      setLoading(false);
    }
  };

  const createProject = async () => {
    if (!newProject.name.trim()) {
      Alert.alert('Error', 'Project name is required');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert('Error', 'You must be logged in to create a project');
        return;
      }

      const { data, error } = await supabase
        .from('projects')
        .insert([
          {
            name: newProject.name.trim(),
            address: newProject.address.trim() || null,
            project_type: newProject.project_type,
            user_id: user.id,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error('Error creating project:', error);
        Alert.alert('Error', `Failed to create project: ${error.message}`);
      } else {
        Alert.alert('Success', 'Project created successfully!');
        setShowCreateModal(false);
        setNewProject({ name: '', address: '', project_type: 'residential' });
        fetchProjects();
      }
    } catch (error) {
      console.error('Create project error:', error);
      Alert.alert('Error', 'An error occurred while creating the project');
    }
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0066CC" />
          <Text style={styles.loadingText}>Loading projects...</Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollView}>
          {projects.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialIcons name="folder-open" size={64} color="#CCCCCC" />
              <Text style={styles.emptyText}>No projects yet</Text>
              <Text style={styles.emptySubtext}>Create your first project to get started</Text>
            </View>
          ) : (
            projects.map((project) => (
              <TouchableOpacity
                key={project.id}
                style={styles.projectCard}
                onPress={() => {
                  Alert.alert(
                    project.name,
                    'What would you like to do?',
                    [
                      {
                        text: 'Start Inspection',
                        onPress: () => navigation.navigate('LiveInspection', {
                          projectId: project.id,
                          projectName: project.name,
                          inspectionType: 'building'
                        })
                      },
                      { text: 'Cancel', style: 'cancel' }
                    ]
                  );
                }}
              >
                <Text style={styles.projectName}>{project.name}</Text>
                {project.address && (
                  <Text style={styles.projectAddress}>
                    <MaterialIcons name="location-on" size={14} color="#666666" /> {project.address}
                  </Text>
                )}
                <View style={styles.projectFooter}>
                  <Text style={styles.projectType}>{project.project_type}</Text>
                  <Text style={styles.projectDate}>
                    {new Date(project.created_at).toLocaleDateString()}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowCreateModal(true)}
      >
        <MaterialIcons name="add" size={28} color="white" />
      </TouchableOpacity>

      {/* Create Project Modal */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create New Project</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <MaterialIcons name="close" size={24} color="#666666" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Project Name *"
              value={newProject.name}
              onChangeText={(text) => setNewProject({ ...newProject, name: text })}
            />

            <TextInput
              style={styles.input}
              placeholder="Project Address (optional)"
              value={newProject.address}
              onChangeText={(text) => setNewProject({ ...newProject, address: text })}
            />

            <Text style={styles.label}>Project Type</Text>
            <View style={styles.typeButtons}>
              {['residential', 'commercial', 'industrial'].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeButton,
                    newProject.project_type === type && styles.typeButtonActive,
                  ]}
                  onPress={() => setNewProject({ ...newProject, project_type: type })}
                >
                  <Text
                    style={[
                      styles.typeButtonText,
                      newProject.project_type === type && styles.typeButtonTextActive,
                    ]}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.createButton} onPress={createProject}>
              <Text style={styles.createButtonText}>Create Project</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666666',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999999',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#CCCCCC',
    marginTop: 8,
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
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  projectFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  projectType: {
    fontSize: 12,
    color: '#0066CC',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  projectDate: {
    fontSize: 12,
    color: '#999999',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0066CC',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    minHeight: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: '#F8F8F8',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 8,
  },
  typeButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    backgroundColor: '#F8F8F8',
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: '#0066CC',
    borderColor: '#0066CC',
  },
  typeButtonText: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '600',
  },
  typeButtonTextActive: {
    color: 'white',
  },
  createButton: {
    backgroundColor: '#0066CC',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  createButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
});
