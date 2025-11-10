import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, BackHandler } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { CameraView, Camera } from 'expo-camera';
import * as Location from 'expo-location';
import AIVisionService from '../services/AIVisionService';
import VoiceService from '../services/VoiceService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function InspectionScreen({ navigation }) {
  const cameraRef = useRef(null);
  const analysisIntervalRef = useRef(null);
  const inspectionStartTime = useRef(new Date());
  const hasStarted = useRef(false);

  const [hasPermissions, setHasPermissions] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [location, setLocation] = useState(null);
  const [jurisdiction, setJurisdiction] = useState('IBC 2021');
  const [isListening, setIsListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true); // Voice mode toggle
  const [photos, setPhotos] = useState([]);
  const [defects, setDefects] = useState([]);
  const [severity, setSeverity] = useState(null); // 'yellow', 'orange', 'red'

  useEffect(() => {
    requestPermissions();
    greetUser();

    // Handle back button
    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleEndInspection);

    return () => {
      stopAnalysisLoop();
      VoiceService.stopListening();
      backHandler.remove();
    };
  }, []);

  const greetUser = async () => {
    if (voiceEnabled) {
      await VoiceService.speak('Aloha, welcome to VIS Inspection. Ready to begin? Just say start.');
    }
  };

  const toggleVoiceMode = async () => {
    if (voiceEnabled) {
      // Disable voice
      await VoiceService.stopListening();
      setIsListening(false);
      setVoiceEnabled(false);
      await VoiceService.speak('Voice mode disabled. Using text only.');
    } else {
      // Enable voice
      setVoiceEnabled(true);
      await VoiceService.speak('Voice mode enabled.');
      startVoiceCommands();
    }
  };

  const requestPermissions = async () => {
    try {
      const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
      const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();

      if (cameraStatus !== 'granted' || locationStatus !== 'granted') {
        await VoiceService.speak('Camera and location permissions are required.');
        return;
      }

      setHasPermissions(true);

      // Get location and jurisdiction
      const loc = await Location.getCurrentPositionAsync({});
      setLocation(loc.coords);

      // Get jurisdiction from reverse geocoding
      const geocode = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });

      if (geocode.length > 0) {
        const addr = geocode[0];
        const state = addr.region || addr.isoCountryCode;
        setJurisdiction(`${state} - IBC 2021`);
      }

      // Start voice commands
      startVoiceCommands();
    } catch (error) {
      console.error('Permission error:', error);
      await VoiceService.speak('Unable to start inspection. Please check permissions.');
    }
  };

  const startVoiceCommands = async () => {
    const success = await VoiceService.startListening(
      (result) => {
        console.log('Voice command:', result.command, result.transcription);
        handleVoiceCommand(result.command, result.transcription);
      },
      (error) => {
        console.error('Voice error:', error);
      }
    );
    setIsListening(success);
  };

  const handleVoiceCommand = async (command, transcription) => {
    // Handle "start" command to begin inspection
    if (!hasStarted.current && (transcription?.toLowerCase().includes('start') || command === 'start_inspection')) {
      hasStarted.current = true;
      await VoiceService.speak('Starting inspection now.');
      startAnalysisLoop();
      return;
    }

    switch (command) {
      case 'take_photo':
        await capturePhoto();
        break;
      case 'mark_defect':
        await markDefect(transcription);
        break;
      case 'identify_material':
        await identifyMaterial();
        break;
      case 'go_home':
      case 'finish':
      case 'save_inspection':
        await handleEndInspection();
        break;
      case 'help':
        await VoiceService.speak('Say: take photo, mark defect, or finish inspection');
        break;
      default:
        // For unknown commands during inspection, treat as defect note
        if (hasStarted.current && transcription && transcription.length > 5) {
          await markDefect(transcription);
        }
    }
  };

  const startAnalysisLoop = () => {
    // Immediate first analysis
    analyzeCurrentFrame();

    // Then analyze every 4 seconds (optimized for minimal flickering)
    analysisIntervalRef.current = setInterval(async () => {
      await analyzeCurrentFrame();
    }, 4000);
  };

  const stopAnalysisLoop = () => {
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current);
      analysisIntervalRef.current = null;
    }
  };

  const analyzeCurrentFrame = async () => {
    if (!cameraRef.current || isAnalyzing || !hasPermissions || !hasStarted.current) return;

    try {
      setIsAnalyzing(true);

      // Capture frame with optimized settings to minimize flickering
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.4, // Balance between quality and speed
        base64: false,
        skipProcessing: true, // Critical for preventing camera pause
        exif: false,
      });

      // Analyze with OpenAI GPT-4 Vision
      const result = await AIVisionService.analyzeFrame(photo.uri, {
        projectType: 'residential',
        jurisdiction,
        location,
      });

      if (result && !result.error) {
        setAnalysis(result);

        // Determine severity based on issues
        const severityLevel = determineSeverity(result.issues);
        setSeverity(severityLevel);

        // Natural narration with category detection (only if voice enabled)
        if (voiceEnabled) {
          if (result.category && result.narration) {
            await VoiceService.speak(`I see ${result.category}. ${result.narration}`);
          } else if (result.narration) {
            await VoiceService.speak(result.narration);
          }
        }
      }

      setIsAnalyzing(false);
    } catch (error) {
      console.error('Analysis error:', error);
      setIsAnalyzing(false);
    }
  };

  const determineSeverity = (issues) => {
    if (!issues || issues.length === 0 || issues[0] === 'None visible') return null;

    const issuesText = issues.join(' ').toLowerCase();

    // Red: Safety critical
    if (issuesText.includes('safety') || issuesText.includes('fire') || issuesText.includes('structural') || issuesText.includes('collapse') || issuesText.includes('hazard')) {
      return 'red';
    }

    // Orange: Code violation
    if (issuesText.includes('violation') || issuesText.includes('non-compliant') || issuesText.includes('incorrect') || issuesText.includes('improper')) {
      return 'orange';
    }

    // Yellow: Warning/recommendation
    return 'yellow';
  };

  const capturePhoto = async () => {
    if (!cameraRef.current) {
      await VoiceService.speak('Camera not ready');
      return;
    }

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
      });

      setPhotos([...photos, {
        uri: photo.uri,
        location,
        timestamp: new Date(),
        analysis: analysis ? analysis.rawText : '',
        severity: severity,
      }]);

      await VoiceService.speak('Photo captured');
      console.log('Photo captured:', photo.uri);
    } catch (error) {
      console.error('Photo capture error:', error);
      await VoiceService.speak('Photo capture failed');
    }
  };

  const markDefect = async (note = '') => {
    if (analysis) {
      const defect = {
        timestamp: new Date(),
        location,
        issues: analysis.issues || [],
        category: analysis.category || 'General',
        note: note || 'Voice marked defect',
        analysis: analysis.rawText,
        severity: severity || 'yellow',
      };

      setDefects([...defects, defect]);
      await VoiceService.speak('Defect marked');
      console.log('Defect marked:', defect);
    } else {
      await VoiceService.speak('No issues detected to mark');
    }
  };

  const identifyMaterial = async () => {
    if (!cameraRef.current) {
      await VoiceService.speak('Camera not ready');
      return;
    }

    try {
      await VoiceService.speak('Identifying material');

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
      });

      const result = await AIVisionService.analyzeFrame(photo.uri, {
        projectType: 'material_identification',
        jurisdiction,
        location,
      });

      if (result && result.materials && result.materials.length > 0) {
        const materialsList = result.materials.join(', ');
        await VoiceService.speak(`Identified materials: ${materialsList}`);
      } else {
        await VoiceService.speak('Unable to identify material');
      }
    } catch (error) {
      console.error('Material identification error:', error);
      await VoiceService.speak('Material identification failed');
    }
  };

  const handleEndInspection = async () => {
    stopAnalysisLoop();
    await VoiceService.stopListening();

    const inspectionDuration = Math.round((new Date() - inspectionStartTime.current) / 1000 / 60);
    const summary = `Inspection complete. Captured ${photos.length} photos and ${defects.length} defects in ${inspectionDuration} minutes.`;

    await VoiceService.speak(summary);

    // Navigate to report for review
    if (defects.length > 0 || photos.length > 0) {
      navigation.replace('Report', {
        photos,
        defects,
        duration: inspectionDuration,
        location,
        jurisdiction,
      });
    } else {
      navigation.replace('Home');
    }

    return true;
  };

  const handleManualStart = async () => {
    if (!hasStarted.current) {
      hasStarted.current = true;
      await VoiceService.speak('Starting inspection now.');
      startAnalysisLoop();
    }
  };

  if (!hasPermissions) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066CC" />
        <Text style={styles.loadingText}>Requesting camera and location permissions...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Live Camera View */}
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
      />

      {/* Severity Overlay */}
      {severity && (
        <View style={[
          styles.severityOverlay,
          severity === 'red' && styles.severityRed,
          severity === 'orange' && styles.severityOrange,
          severity === 'yellow' && styles.severityYellow,
        ]} />
      )}

      {/* AI Analysis Overlay */}
      <View style={styles.overlay}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>VIS Eyesight</Text>
          <View style={styles.statusIndicators}>
            <TouchableOpacity onPress={toggleVoiceMode} style={styles.voiceToggle}>
              <Text style={[styles.statusBadge, !voiceEnabled && styles.statusBadgeDisabled]}>
                {voiceEnabled ? 'VOICE' : 'TEXT'}
              </Text>
            </TouchableOpacity>
            {isListening && voiceEnabled && <Text style={styles.statusBadge}>MIC</Text>}
            {isAnalyzing && <Text style={styles.statusBadge}>AI</Text>}
          </View>
        </View>

        {/* Start Button (if not started) */}
        {!hasStarted.current && (
          <View style={styles.startContainer}>
            <TouchableOpacity style={styles.startButton} onPress={handleManualStart}>
              <Text style={styles.startButtonText}>TAP TO START</Text>
              <Text style={styles.startButtonSubtext}>or say "start"</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* AI Analysis Results - Only show when issues detected */}
        {hasStarted.current && analysis && analysis.issues && analysis.issues.length > 0 && analysis.issues[0] !== 'None visible' && (
          <View style={[
            styles.analysisCard,
            severity === 'red' && styles.analysisCardRed,
            severity === 'orange' && styles.analysisCardOrange,
            severity === 'yellow' && styles.analysisCardYellow,
          ]}>
            <Text style={styles.analysisTitle}>
              {severity === 'red' && 'CRITICAL ISSUE'}
              {severity === 'orange' && 'CODE VIOLATION'}
              {severity === 'yellow' && 'WARNING'}
            </Text>

            {analysis.category && (
              <Text style={styles.categoryText}>Category: {analysis.category}</Text>
            )}

            {/* Issues */}
            <View style={styles.analysisSection}>
              {analysis.issues.map((issue, index) => (
                <Text key={index} style={styles.issueText}>• {issue}</Text>
              ))}
            </View>
          </View>
        )}

        {/* Control Buttons - Only show after started */}
        {hasStarted.current && (
          <View style={styles.controls}>
            <TouchableOpacity style={styles.controlButton} onPress={capturePhoto}>
              <Text style={styles.controlButtonText}>PHOTO</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.controlButton} onPress={() => markDefect()}>
              <Text style={styles.controlButtonText}>MARK</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.controlButton} onPress={identifyMaterial}>
              <Text style={styles.controlButtonText}>ID</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.controlButton, styles.finishButton]} onPress={handleEndInspection}>
              <Text style={styles.controlButtonText}>END</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Stats Badge */}
        {(photos.length > 0 || defects.length > 0) && (
          <View style={styles.statsBadge}>
            <Text style={styles.statsText}>
              PHOTOS: {photos.length}  •  DEFECTS: {defects.length}
            </Text>
          </View>
        )}

        {/* Voice Commands Help */}
        <View style={styles.helpCard}>
          <Text style={styles.helpText}>
            {!hasStarted.current
              ? 'Say "start" to begin inspection'
              : 'Say: "take photo" • "mark defect" • "finish"'
            }
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  camera: {
    flex: 1,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  severityOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.15,
  },
  severityRed: {
    backgroundColor: '#FF0000',
  },
  severityOrange: {
    backgroundColor: '#FFA500',
  },
  severityYellow: {
    backgroundColor: '#FFFF00',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  statusIndicators: {
    flexDirection: 'row',
    gap: 8,
  },
  statusBadge: {
    backgroundColor: 'rgba(0, 102, 204, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    overflow: 'hidden',
  },
  statusBadgeDisabled: {
    backgroundColor: 'rgba(128, 128, 128, 0.7)',
  },
  voiceToggle: {
    // No additional styles needed, TouchableOpacity wraps the badge
  },
  startContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: 'rgba(0, 204, 102, 0.95)',
    borderRadius: 20,
    paddingVertical: 30,
    paddingHorizontal: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  startButtonText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  startButtonSubtext: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    opacity: 0.9,
  },
  analysisCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderLeftWidth: 4,
  },
  analysisCardRed: {
    borderLeftColor: '#FF0000',
  },
  analysisCardOrange: {
    borderLeftColor: '#FFA500',
  },
  analysisCardYellow: {
    borderLeftColor: '#FFCC00',
  },
  analysisTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0066CC',
    marginBottom: 8,
  },
  analysisSection: {
    marginBottom: 8,
  },
  issueText: {
    fontSize: 14,
    color: '#1A1A1A',
    lineHeight: 20,
    marginBottom: 4,
  },
  controls: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 8,
  },
  controlButton: {
    flex: 1,
    backgroundColor: 'rgba(0, 102, 204, 0.9)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  finishButton: {
    backgroundColor: 'rgba(0, 204, 102, 0.9)',
  },
  controlButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statsBadge: {
    position: 'absolute',
    bottom: 160,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0, 204, 102, 0.9)',
    borderRadius: 8,
    padding: 12,
  },
  statsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  helpCard: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(26, 26, 26, 0.8)',
    borderRadius: 8,
    padding: 12,
  },
  helpText: {
    fontSize: 12,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 18,
  },
});
