import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';
import { TextInput } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import PlanStorageService from '../services/PlanStorageService';
import { runDppPrecheck } from '../services/DppPrecheckService';
import * as FileSystem from 'expo-file-system';

export default function BuildingCodesScreen() {
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
      // Convert image to base64 for DPP pre-check
      const base64Image = await FileSystem.readAsStringAsync(imageUri, {
        encoding: 'base64',
      });
      const imageUrl = `data:image/jpeg;base64,${base64Image}`;

      // Run actual DPP pre-check with code citations and page numbers
      const dppResult = await runDppPrecheck({
        jurisdiction: jurisdiction.toLowerCase(),
        projectType: projectType.toLowerCase(),
        imageUrl,
      });

      // Save plan with DPP analysis
      await PlanStorageService.savePlan({
        imageUri,
        jurisdiction,
        projectType,
        analysis: dppResult.analysis,
        dppRequirements: dppResult.dpp_requirements,
      });

      setResult({
        ...dppResult.analysis,
        dpp_requirements: dppResult.dpp_requirements,
        timestamp: dppResult.timestamp,
      });
      setAnalyzing(false);
    } catch (error) {
      console.error('Analysis error:', error);
      Alert.alert('Analysis failed', error.message || 'Please try again');
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
            <Text style={styles.resultTitle}>📋 Honolulu DPP Pre-Check Complete</Text>
            <Text style={styles.resultText}>Project Type: {projectType}</Text>
            <Text style={styles.resultText}>Analysis: {result.summary || result.compliance}</Text>

            {/* Required Forms Checklist */}
            {result.dpp_requirements && result.dpp_requirements.required_forms && (
              <View style={styles.checklistSection}>
                <Text style={styles.sectionSubtitle}>Required Forms:</Text>
                {result.dpp_requirements.required_forms.map((form, idx) => (
                  <Text key={idx} style={styles.checklistItem}>✓ {form}</Text>
                ))}
              </View>
            )}

            {/* Code References with Page Numbers */}
            {result.dpp_requirements && result.dpp_requirements.code_references && (
              <View style={styles.codeReferencesSection}>
                <Text style={styles.sectionSubtitle}>Applicable Building Codes:</Text>
                {result.dpp_requirements.code_references.map((ref, idx) => (
                  <View key={idx} style={styles.codeReferenceItem}>
                    <Text style={styles.codeNumber}>{ref.code}</Text>
                    <Text style={styles.codeDescription}>{ref.description}</Text>
                    <Text style={styles.codePage}>Page {ref.page}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Violations Found by AI */}
            {result.violations && result.violations.length > 0 && (
              <View style={styles.violationsSection}>
                <Text style={styles.violationsTitle}>⚠️ Issues Detected:</Text>
                {result.violations.map((violation, idx) => (
                  <View key={idx} style={styles.violationItem}>
                    <Text style={styles.violationCode}>{violation.code || 'General'}</Text>
                    <Text style={styles.violationText}>{violation.issue || violation.description}</Text>
                    {violation.recommendation && (
                      <Text style={styles.violationFix}>Fix: {violation.recommendation}</Text>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Recommendations */}
            {result.recommendations && result.recommendations.length > 0 && (
              <View style={styles.recommendationsSection}>
                <Text style={styles.sectionSubtitle}>Recommendations:</Text>
                {result.recommendations.map((rec, idx) => (
                  <Text key={idx} style={styles.recommendationText}>• {rec}</Text>
                ))}
              </View>
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
  violationsSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  violationsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF6B6B',
    marginBottom: 8,
  },
  violationText: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
    lineHeight: 20,
  },
  dppReferenceCard: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#F0F7FF',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#0066CC',
  },
  dppTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0066CC',
    marginBottom: 8,
  },
  dppAuthority: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  dppMessage: {
    fontSize: 13,
    color: '#666666',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  dppButton: {
    backgroundColor: '#0066CC',
    borderRadius: 6,
    padding: 12,
    alignItems: 'center',
  },
  dppButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
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
  sectionSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginTop: 12,
    marginBottom: 8,
  },
  checklistSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  checklistItem: {
    fontSize: 14,
    color: '#00CC66',
    marginBottom: 6,
    paddingLeft: 8,
  },
  codeReferencesSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  codeReferenceItem: {
    backgroundColor: '#F8F8F8',
    padding: 10,
    borderRadius: 6,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#0066CC',
  },
  codeNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0066CC',
    marginBottom: 4,
  },
  codeDescription: {
    fontSize: 13,
    color: '#1A1A1A',
    marginBottom: 2,
  },
  codePage: {
    fontSize: 12,
    color: '#666666',
    fontStyle: 'italic',
  },
  violationItem: {
    backgroundColor: '#FFF5F5',
    padding: 10,
    borderRadius: 6,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#FF6B6B',
  },
  violationCode: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FF6B6B',
    marginBottom: 4,
  },
  violationFix: {
    fontSize: 12,
    color: '#666666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  recommendationsSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  recommendationText: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
    lineHeight: 20,
  },
});
