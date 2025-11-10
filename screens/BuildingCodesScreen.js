import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';
import { TextInput, Button } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import AIVisionService from '../services/AIVisionService';
import BuildingCodeService from '../services/BuildingCodeService';
import PlanStorageService from '../services/PlanStorageService';

export default function BuildingCodesScreen({ navigation }) {
  const [jurisdiction, setJurisdiction] = useState('Honolulu');
  const [projectType, setProjectType] = useState('residential');
  const [planImage, setPlanImage] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);

  const takePlanPhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera permission is required to scan plans');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 1,
      allowsEditing: false,
    });

    if (!result.canceled) {
      setPlanImage(result.assets[0].uri);
      analyzePlan(result.assets[0].uri);
    }
  };

  const uploadPlan = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled) {
        setPlanImage(result.assets[0].uri);
        analyzePlan(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Upload failed', 'Please try again');
    }
  };

  const analyzePlan = async (imageUri) => {
    setAnalyzing(true);
    try {
      // Fetch Honolulu codes first
      await BuildingCodeService.fetchHonoluluCodes();

      // Analyze plan with AI
      const analysis = await AIVisionService.analyzeFrame(imageUri, {
        projectType,
        jurisdiction,
      });

      // Get permit requirements based on detected category
      const permitInfo = BuildingCodeService.getPermitRequirements(analysis.category);

      // Save plan
      await PlanStorageService.savePlan({
        imageUri,
        jurisdiction,
        projectType,
        analysis,
        permitInfo,
      });

      setResult({ ...analysis, permitInfo });
      setAnalyzing(false);
    } catch (error) {
      console.error('Analysis error:', error);
      Alert.alert('Analysis failed', 'Please try again');
      setAnalyzing(false);
    }
  };

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
          style={styles.input}
          outlineColor="#E5E5E5"
          activeOutlineColor="#0066CC"
        />

        <TextInput
          label="Project Type"
          value={projectType}
          onChangeText={setProjectType}
          mode="outlined"
          style={styles.input}
          outlineColor="#E5E5E5"
          activeOutlineColor="#0066CC"
        />

        {planImage && (
          <Image source={{ uri: planImage }} style={styles.planPreview} />
        )}

        <TouchableOpacity style={styles.uploadButton} onPress={takePlanPhoto}>
          <Text style={styles.uploadButtonText}>SCAN PLANS</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.uploadButton} onPress={uploadPlan}>
          <Text style={styles.uploadButtonText}>UPLOAD PDF/IMAGE</Text>
        </TouchableOpacity>

        {analyzing && <Text style={styles.analyzingText}>Analyzing against Honolulu Building Codes...</Text>}

        {result && (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Analysis Complete</Text>
            <Text style={styles.resultText}>Category: {result.category}</Text>
            <Text style={styles.resultText}>Compliance: {result.compliance}</Text>
            {result.permitInfo && (
              <>
                <Text style={styles.permitTitle}>{result.permitInfo.permit}</Text>
                <Text style={styles.permitNotes}>{result.permitInfo.notes}</Text>
                <Text style={styles.permitInspector}>Inspector: {result.permitInfo.inspector}</Text>
              </>
            )}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>How It Works</Text>
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            • Upload or scan construction plans{'\n'}
            • AI validates against Honolulu Building Codes{'\n'}
            • Get pre-submission compliance report{'\n'}
            • Permit requirements automatically identified{'\n'}
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
  planPreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginVertical: 12,
    resizeMode: 'contain',
  },
  uploadButton: {
    backgroundColor: '#0066CC',
    borderRadius: 8,
    padding: 16,
    marginVertical: 8,
    alignItems: 'center',
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  analyzingText: {
    fontSize: 14,
    color: '#0066CC',
    textAlign: 'center',
    marginVertical: 12,
    fontStyle: 'italic',
  },
  resultCard: {
    backgroundColor: '#F0FFF8',
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#00CC66',
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#00CC66',
    marginBottom: 12,
  },
  resultText: {
    fontSize: 14,
    color: '#1A1A1A',
    marginBottom: 8,
  },
  permitTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0066CC',
    marginTop: 12,
    marginBottom: 4,
  },
  permitNotes: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  permitInspector: {
    fontSize: 13,
    color: '#999999',
    fontStyle: 'italic',
  },
});
