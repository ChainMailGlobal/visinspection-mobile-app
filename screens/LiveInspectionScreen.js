/**
 * LiveInspectionScreen - Real-time AI code inspection with violation overlay
 * VOICE-ACTIVATED like Spectacles Lens: Say "Aloha" to start, voice commands for capture
 * Uses expo-speech-recognition (requires dev build) + expo-camera
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Camera, CameraType } from 'expo-camera';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import AIVisionService from '../services/AIVisionService';
import VoiceService from '../services/VoiceService';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/env';
import { analyzeLiveInspection } from '../services/McpClient';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function LiveInspectionScreen({ route, navigation }) {
  const { projectId, inspectionType = 'building', projectName = 'Inspection' } = route.params || {};

  const cameraRef = useRef(null);
  const frameIntervalRef = useRef(null);

  const [permission, requestPermission] = Camera.useCameraPermissions();
  const [isScanning, setIsScanning] = useState(false);
  const [violations, setViolations] = useState([]);
  const [overlays, setOverlays] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [voiceState, setVoiceState] = useState({ state: 'IDLE', message: 'Say "Aloha"' });

  // Initialize voice recognition (like Spectacles)
  useEffect(() => {
    const initVoice = async () => {
      const initialized = await VoiceService.initialize();
      if (!initialized) {
        Alert.alert('Voice Error', 'Voice recognition unavailable. Using buttons only.');
      }
    };

    initVoice();

    // Listen for voice state changes
    const unsubscribeState = VoiceService.onStateChange((state) => {
      setVoiceState(state);
      console.log('🎤 Voice state:', state);
    });

    // Listen for voice commands
    const unsubscribeCommands = VoiceService.onCommand((command) => {
      console.log('🎤 Voice command:', command);
      handleVoiceCommand(command);
    });

    return () => {
      stopScanning();
      VoiceService.cleanup();
      unsubscribeState();
      unsubscribeCommands();
    };
  }, []);

  // Handle voice commands
  const handleVoiceCommand = (command) => {
    switch (command) {
      case 'start_inspection':
        if (!isScanning) startScanning();
        break;
      case 'stop_inspection':
        if (isScanning) stopScanning();
        break;
      case 'capture':
        captureViolation('Voice capture');
        break;
    }
  };

  const speakInstruction = async (text) => {
    await VoiceService.speak(text);
  };

  const startScanning = () => {
    if (isScanning) return;

    setIsScanning(true);

    const captureAndAnalyze = async () => {
      if (!cameraRef.current || analyzing) return;

      try {
        setAnalyzing(true);
        const photo = await cameraRef.current.takePictureAsync({
          base64: true,
          quality: 0.7,
          skipProcessing: true,
        });

        // Call MCP with analyze_live_inspection tool
        const analysis = await AIVisionService.analyzeFrame(photo.uri, {
          sessionId: `live_${projectId}_${Date.now()}`,
          frameNumber: Date.now(),
          inspectionType,
        });

        if (analysis && analysis.violations && analysis.violations.length > 0) {
          // Add violations as overlays
          analysis.violations.forEach((violation, idx) => {
            addViolationOverlay(violation, idx);
          });

          // Speak first violation
          if (analysis.violations[0]) {
            const v = analysis.violations[0];
            speakInstruction(`${v.severity} issue: ${v.issue}. Code ${v.code}`);
          }
        }

        setAnalyzing(false);
      } catch (error) {
        console.error('Analysis error:', error);
        setAnalyzing(false);
      }
    };

    // Analyze every 2 seconds
    frameIntervalRef.current = setInterval(captureAndAnalyze, 2000);
    captureAndAnalyze(); // First frame immediately
  };

  const stopScanning = () => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    setIsScanning(false);
  };

  const addViolationOverlay = (violation, index) => {
    const overlay = {
      id: Date.now() + index,
      message: violation.issue || violation.description,
      severity: violation.severity || 'warning',
      code: violation.code || 'Unknown',
      codeReference: violation.codeReference || '',
    };

    setOverlays(prev => [...prev.slice(-3), overlay]); // Keep last 3
    setViolations(prev => [...prev, overlay]);

    // Auto-remove overlay after 10 seconds
    setTimeout(() => {
      setOverlays(prev => prev.filter(o => o.id !== overlay.id));
    }, 10000);
  };

  const captureViolation = async (note = '') => {
    if (!cameraRef.current) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 1,
      });

      // Save to database
      const { data: { user } } = await supabase.auth.getUser();
      if (user && projectId) {
        await supabase.from('captured_violations').insert({
          project_id: projectId,
          user_id: user.id,
          violation_description: note || 'Manually flagged violation',
          photo_url: photo.uri,
          severity: 'warning',
          location: 'Live Inspection',
        });

        speakInstruction('Violation captured');
        Alert.alert('✓ Captured', 'Violation photo saved');
      }
    } catch (error) {
      console.error('Capture error:', error);
    }
  };

  const finishInspection = () => {
    stopScanning();

    Alert.alert(
      '✅ Inspection Complete',
      `Found ${violations.length} potential violation${violations.length !== 1 ? 's' : ''}`,
      [
        { text: 'Continue Scanning', style: 'cancel' },
        { text: 'Generate Report', onPress: () => {
          navigation.navigate('Report', {
            projectId,
            violations: violations.map(v => ({
              description: v.message,
              code: v.code,
              severity: v.severity,
            }))
          });
        }}
      ]
    );
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return '#EF4444';
      case 'high': return '#F59E0B';
      case 'warning': return '#FCD34D';
      default: return '#3B82F6';
    }
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Camera permission required</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <Camera
        ref={cameraRef}
        style={styles.camera}
        type={CameraType.back}
        ratio="16:9"
      >
        {/* Top Bar */}
        <View style={styles.topBar}>
          {/* Voice State Indicator (like Spectacles) */}
          <View style={[
            styles.badge,
            {
              backgroundColor: voiceState.state === 'LISTENING' ? '#3B82F6' :
                              voiceState.state === 'IDLE' ? '#6B7280' : '#10B981'
            }
          ]}>
            <MaterialIcons
              name={voiceState.state === 'LISTENING' ? 'mic' : 'mic-none'}
              size={16}
              color="white"
            />
            <Text style={styles.badgeText}>{voiceState.message}</Text>
          </View>

          {isScanning && (
            <View style={[styles.badge, { backgroundColor: '#10B981', marginLeft: 8 }]}>
              <MaterialIcons name="visibility" size={16} color="white" />
              <Text style={styles.badgeText}>SCANNING</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => {
              stopScanning();
              navigation.goBack();
            }}
          >
            <MaterialIcons name="close" size={32} color="white" />
          </TouchableOpacity>
        </View>

        {/* AR Violation Overlays */}
        <View style={styles.overlaysContainer}>
          {overlays.map((overlay, idx) => (
            <View
              key={overlay.id}
              style={[
                styles.overlay,
                {
                  backgroundColor: getSeverityColor(overlay.severity) + 'F0',
                  borderColor: getSeverityColor(overlay.severity),
                  top: 100 + idx * 100,
                }
              ]}
            >
              <View style={styles.overlayHeader}>
                <MaterialIcons name="warning" size={20} color="white" />
                <Text style={styles.overlayCode}>{overlay.code}</Text>
              </View>
              <Text style={styles.overlayMessage}>{overlay.message}</Text>
              {overlay.codeReference && (
                <Text style={styles.overlayReference}>{overlay.codeReference}</Text>
              )}
            </View>
          ))}
        </View>

        {/* Bottom Controls */}
        <View style={styles.bottomBar}>
          {/* Control Buttons */}
          <View style={styles.controls}>
            <TouchableOpacity
              style={[styles.controlButton, isScanning && styles.controlButtonActive]}
              onPress={isScanning ? stopScanning : startScanning}
            >
              <MaterialIcons
                name={isScanning ? 'pause' : 'play-arrow'}
                size={32}
                color="white"
              />
              <Text style={styles.controlText}>
                {isScanning ? 'PAUSE' : 'SCAN'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => captureViolation()}
            >
              <MaterialIcons name="flag" size={32} color="white" />
              <Text style={styles.controlText}>MARK</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlButton, { backgroundColor: '#10B981' }]}
              onPress={finishInspection}
            >
              <MaterialIcons name="check" size={32} color="white" />
              <Text style={styles.controlText}>DONE</Text>
            </TouchableOpacity>
          </View>

          {/* Violations Counter */}
          {violations.length > 0 && (
            <View style={styles.counter}>
              <Text style={styles.counterText}>
                {violations.length} violation{violations.length !== 1 ? 's' : ''} found
              </Text>
            </View>
          )}

          {/* Analyzing Indicator */}
          {analyzing && (
            <View style={styles.analyzingBox}>
              <ActivityIndicator size="small" color="white" />
              <Text style={styles.analyzingText}>Analyzing...</Text>
            </View>
          )}
        </View>
      </Camera>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  camera: {
    flex: 1,
    width: '100%',
  },
  permissionText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 20,
  },
  button: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    paddingTop: 50,
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59,130,246,0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  overlaysContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 0,
  },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    padding: 16,
    borderRadius: 12,
    borderWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  overlayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  overlayCode: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  overlayMessage: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  overlayReference: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontStyle: 'italic',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 40,
    backgroundColor: 'rgba(0,0,0,0.8)',
    gap: 12,
  },
  transcriptBox: {
    backgroundColor: 'rgba(59,130,246,0.3)',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.5)',
  },
  transcriptText: {
    color: 'white',
    fontSize: 14,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 12,
  },
  controlButton: {
    flex: 1,
    backgroundColor: 'rgba(59,130,246,0.9)',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    gap: 4,
  },
  controlButtonActive: {
    backgroundColor: 'rgba(245,158,11,0.9)',
  },
  controlText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  counter: {
    backgroundColor: 'rgba(239,68,68,0.3)',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  counterText: {
    color: '#FCA5A5',
    fontSize: 14,
    fontWeight: '600',
  },
  analyzingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 8,
  },
  analyzingText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
});
