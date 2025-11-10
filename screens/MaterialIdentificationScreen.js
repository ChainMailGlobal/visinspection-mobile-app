import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';
import { TextInput } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import AIVisionService from '../services/AIVisionService';
import VoiceService from '../services/VoiceService';

export default function MaterialIdentificationScreen() {
  const [materialImage, setMaterialImage] = useState(null);
  const [materialText, setMaterialText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [listening, setListening] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    return () => {
      VoiceService.stopListening();
    };
  }, []);

  const scanMaterial = async () => {
    const { status} = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera permission is required');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 1,
      allowsEditing: false,
    });

    if (!result.canceled) {
      setMaterialImage(result.assets[0].uri);
      analyzeMaterial(result.assets[0].uri);
    }
  };

  const listenForMaterial = async () => {
    setListening(true);
    await VoiceService.speak('What material are you looking at?');

    const success = await VoiceService.startListening(
      (result) => {
        if (result.transcription) {
          setMaterialText(result.transcription);
          lookupMaterial(result.transcription);
          VoiceService.stopListening();
          setListening(false);
        }
      },
      (error) => {
        console.error('Voice error:', error);
        setListening(false);
      }
    );

    if (!success) {
      setListening(false);
    }
  };

  const analyzeMaterial = async (imageUri) => {
    setAnalyzing(true);
    try {
      const analysis = await AIVisionService.analyzeFrame(imageUri, {
        projectType: 'material_identification',
        jurisdiction: 'Honolulu',
      });

      setResult(analysis);
      setAnalyzing(false);

      // Voice feedback
      if (analysis.materials && analysis.materials.length > 0) {
        await VoiceService.speak(`I see ${analysis.materials.join(', ')}. ${analysis.compliance}`);
      }
    } catch (error) {
      console.error('Material analysis error:', error);
      Alert.alert('Analysis failed', 'Please try again');
      setAnalyzing(false);
    }
  };

  const lookupMaterial = async (materialName) => {
    setAnalyzing(true);
    try {
      // Simple lookup - in real app this would query a material database
      const mockResult = {
        materials: [materialName],
        compliance: `Checking Honolulu Building Code requirements for ${materialName}...`,
        category: 'Material',
      };

      setResult(mockResult);
      await VoiceService.speak(`Looking up ${materialName} in Honolulu Building Code`);
      setAnalyzing(false);
    } catch (error) {
      console.error('Lookup error:', error);
      setAnalyzing(false);
    }
  };

  const handleTextSubmit = () => {
    if (materialText.trim()) {
      lookupMaterial(materialText.trim());
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Material Identification</Text>
        <Text style={styles.subtitle}>AI-powered material analysis</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.methodTitle}>Identify by:</Text>

        {/* Photo Scan */}
        <TouchableOpacity style={styles.methodButton} onPress={scanMaterial}>
          <Text style={styles.methodButtonText}>SCAN WITH CAMERA</Text>
        </TouchableOpacity>

        {/* Voice Input */}
        <TouchableOpacity
          style={[styles.methodButton, styles.voiceButton]}
          onPress={listenForMaterial}
        >
          <Text style={styles.methodButtonText}>
            {listening ? 'LISTENING...' : 'SAY MATERIAL NAME'}
          </Text>
        </TouchableOpacity>

        {/* Text Input */}
        <TextInput
          label="Or type material name"
          value={materialText}
          onChangeText={setMaterialText}
          mode="outlined"
          placeholder="e.g., 2x4 lumber, concrete, drywall"
          style={styles.input}
          outlineColor="#E5E5E5"
          activeOutlineColor="#0066CC"
          onSubmitEditing={handleTextSubmit}
          returnKeyType="search"
        />

        {materialImage && (
          <Image source={{ uri: materialImage }} style={styles.materialPreview} />
        )}

        {analyzing && <Text style={styles.analyzingText}>Analyzing material...</Text>}

        {result && (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Material Identified</Text>
            {result.materials && result.materials.map((material, index) => (
              <Text key={index} style={styles.materialText}>• {material}</Text>
            ))}
            <Text style={styles.complianceText}>
              Compliance: {result.compliance}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>How It Works</Text>
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            • Scan with camera for AI identification{'\n'}
            • Say the material name hands-free{'\n'}
            • Type it in if you already know{'\n'}
            • Get Honolulu code compliance info{'\n'}
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
  methodTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  methodButton: {
    backgroundColor: '#0066CC',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  voiceButton: {
    backgroundColor: '#00CC66',
  },
  methodButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  input: {
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  materialPreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginVertical: 12,
    resizeMode: 'contain',
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
  materialText: {
    fontSize: 14,
    color: '#1A1A1A',
    marginBottom: 6,
  },
  complianceText: {
    fontSize: 14,
    color: '#666666',
    marginTop: 8,
    fontStyle: 'italic',
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
