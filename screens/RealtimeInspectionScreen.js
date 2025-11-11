/**
 * RealtimeInspectionScreen - OpenAI Realtime Voice + Vision AR Inspection
 * Features: Voice-to-voice AI, frame-by-frame vision analysis, live overlays
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Camera, CameraType } from 'expo-camera';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { VoiceInspectorService } from '../services/VoiceInspectorService';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/env';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const { width, height } = Dimensions.get('window');

export default function RealtimeInspectionScreen({ route, navigation }) {
  const { projectId, inspectionType = 'building', projectName = 'Inspection' } = route.params || {};

  const cameraRef = useRef(null);
  const voiceInspectorRef = useRef(null);
  const frameIntervalRef = useRef(null);

  const [permission, requestPermission] = Camera.useCameraPermissions();
  const [connectionState, setConnectionState] = useState('disconnected'); // disconnected, connecting, connected
  const [isAIActive, setIsAIActive] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const [overlays, setOverlays] = useState([]);
  const [violations, setViolations] = useState([]);
  const [transcript, setTranscript] = useState([]);
  const [textInput, setTextInput] = useState('');
  const [scanComplete, setScanComplete] = useState(false);
  const [scanSummary, setScanSummary] = useState('');

  // Initialize AI connection on mount
  useEffect(() => {
    if (permission?.granted) {
      connectAI();
    }

    return () => {
      disconnectAI();
    };
  }, [permission]);

  // Start frame capture when AI is active
  useEffect(() => {
    if (!isAIActive || !cameraRef.current) {
      return;
    }

    const captureFrame = async () => {
      try {
        if (!cameraRef.current) return;

        const photo = await cameraRef.current.takePictureAsync({
          base64: true,
          quality: 0.7,
          skipProcessing: true,
        });

        if (photo.base64 && voiceInspectorRef.current) {
          await voiceInspectorRef.current.sendVisionFrame(photo.base64);
        }
      } catch (error) {
        console.error('Frame capture error:', error);
      }
    };

    // Capture frame every 3 seconds for real-time analysis
    const interval = setInterval(captureFrame, 3000);
    frameIntervalRef.current = interval;

    // Capture first frame immediately
    setTimeout(captureFrame, 500);

    return () => {
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
      }
    };
  }, [isAIActive]);

  const connectAI = async () => {
    try {
      setConnectionState('connecting');

      voiceInspectorRef.current = new VoiceInspectorService({
        onTranscript: (text, isFinal) => {
          if (isFinal) {
            setTranscript(prev => [...prev, { text, role: 'user', timestamp: Date.now() }]);
          }
        },
        onViolation: async (violation) => {
          console.log('🚨 Violation detected:', violation);
          setViolations(prev => [...prev, violation]);

          // Add as temporary AR overlay
          const overlay = {
            id: Date.now(),
            message: violation.description,
            severity: violation.severity,
            codeReference: violation.codeReference,
          };
          setOverlays(prev => [...prev.slice(-4), overlay]);

          // Auto-remove overlay after 10 seconds
          setTimeout(() => {
            setOverlays(prev => prev.filter(o => o.id !== overlay.id));
          }, 10000);

          // Save to database
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user && projectId) {
              await supabase.from('captured_violations').insert({
                project_id: projectId,
                user_id: user.id,
                violation_description: violation.description,
                code_reference: violation.codeReference || '',
                severity: violation.severity || 'warning',
                location: 'AR Camera Scan',
              });
            }
          } catch (error) {
            console.error('Error saving violation:', error);
          }
        },
        onSpeaking: (speaking) => {
          setIsSpeaking(speaking);
          if (speaking) {
            setTranscript(prev => [...prev, { text: '🎙️ AI is responding...', role: 'assistant', timestamp: Date.now() }]);
          }
        },
        onTakePhoto: async (note) => {
          console.log('📸 AI requested photo:', note);
          Alert.alert('Photo Capture', note || 'AI wants to capture this area');
        },
        onScanComplete: (summary) => {
          console.log('✅ Scan complete:', summary);
          setScanComplete(true);
          setScanSummary(summary);
          Alert.alert(
            '✅ Scan Complete',
            summary,
            [
              { text: 'Continue Scanning', style: 'cancel' },
              { text: 'End & View Results', onPress: () => navigation.goBack() }
            ]
          );
        },
      });

      await voiceInspectorRef.current.init(projectId, inspectionType, projectName, '');

      setConnectionState('connected');
      setIsAIActive(true);

      Alert.alert(
        '🎙️ AI Voice Inspector Ready',
        'Point your camera at work. I\'ll check codes and respond by voice.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('AI connection error:', error);
      setConnectionState('disconnected');
      Alert.alert(
        'Connection Error',
        error.message || 'Could not connect to AI inspector. Check your internet connection.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Retry', onPress: connectAI }
        ]
      );
    }
  };

  const disconnectAI = () => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
    }
    if (voiceInspectorRef.current) {
      voiceInspectorRef.current.disconnect();
      voiceInspectorRef.current = null;
    }
    setIsAIActive(false);
    setConnectionState('disconnected');
  };

  const sendTextMessage = () => {
    if (!textInput.trim() || !voiceInspectorRef.current) return;

    try {
      voiceInspectorRef.current.sendText(textInput);
      setTranscript(prev => [...prev, { text: textInput, role: 'user', timestamp: Date.now() }]);
      setTextInput('');
    } catch (error) {
      console.error('Error sending text:', error);
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return '#EF4444'; // red
      case 'warning': return '#F59E0B'; // yellow
      default: return '#3B82F6'; // blue
    }
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.permissionText}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Camera permission is required</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Camera View */}
      <Camera
        ref={cameraRef}
        style={styles.camera}
        type={CameraType.back}
        ratio="16:9"
      >
        {/* Top Bar */}
        <View style={styles.topBar}>
          <View style={styles.topLeft}>
            <View style={styles.badge}>
              <MaterialIcons name="videocam" size={16} color="white" />
              <Text style={styles.badgeText}>{inspectionType.toUpperCase()}</Text>
            </View>
            {isAIActive && (
              <View style={[styles.badge, styles.badgeOutline]}>
                <Text style={styles.badgeSmallText}>
                  {isSpeaking ? '🎤 Speaking' : '👂 Listening'}
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => {
              disconnectAI();
              navigation.goBack();
            }}
          >
            <MaterialIcons name="close" size={32} color="white" />
          </TouchableOpacity>
        </View>

        {/* AR Overlays */}
        <View style={styles.overlaysContainer}>
          {overlays.map((overlay, idx) => (
            <View
              key={overlay.id}
              style={[
                styles.overlay,
                {
                  backgroundColor: getSeverityColor(overlay.severity) + 'E6',
                  borderColor: getSeverityColor(overlay.severity),
                  top: 80 + idx * 90,
                }
              ]}
            >
              <Text style={styles.overlayMessage}>{overlay.message}</Text>
              {overlay.codeReference && (
                <Text style={styles.overlayCode}>{overlay.codeReference}</Text>
              )}
            </View>
          ))}
        </View>

        {/* Bottom Controls */}
        <View style={styles.bottomBar}>
          {/* Text Input */}
          {isAIActive && (
            <View style={styles.textInputContainer}>
              <TextInput
                style={styles.textInput}
                value={textInput}
                onChangeText={setTextInput}
                placeholder="Ask about what you see..."
                placeholderTextColor="rgba(255,255,255,0.5)"
                onSubmitEditing={sendTextMessage}
                returnKeyType="send"
              />
              <TouchableOpacity
                style={[styles.sendButton, !textInput.trim() && styles.sendButtonDisabled]}
                onPress={sendTextMessage}
                disabled={!textInput.trim()}
              >
                <MaterialIcons name="send" size={20} color="white" />
              </TouchableOpacity>
            </View>
          )}

          {/* Connection Status */}
          <View style={styles.statusContainer}>
            <View style={[
              styles.statusDot,
              connectionState === 'connected' ? styles.statusDotConnected :
              connectionState === 'connecting' ? styles.statusDotConnecting :
              styles.statusDotDisconnected
            ]} />
            <Text style={styles.statusText}>
              {connectionState === 'connected' && isAIActive ? '🎙️ AI Active' :
               connectionState === 'connecting' ? 'Connecting...' :
               'Disconnected'}
            </Text>
          </View>

          {/* Violations Counter */}
          {violations.length > 0 && (
            <View style={styles.violationsCounter}>
              <MaterialIcons name="warning" size={20} color="#F59E0B" />
              <Text style={styles.violationsText}>
                {violations.length} violation{violations.length !== 1 ? 's' : ''} detected
              </Text>
            </View>
          )}

          {/* Transcript (last 3 messages) */}
          {transcript.length > 0 && (
            <ScrollView style={styles.transcriptContainer}>
              {transcript.slice(-3).map((t, idx) => (
                <Text
                  key={idx}
                  style={[
                    styles.transcriptText,
                    t.role === 'user' ? styles.transcriptUser : styles.transcriptAssistant
                  ]}
                >
                  {t.text}
                </Text>
              ))}
            </ScrollView>
          )}

          {/* Scan Complete */}
          {scanComplete && (
            <View style={styles.scanCompleteContainer}>
              <Text style={styles.scanCompleteTitle}>✅ Scan Complete</Text>
              <Text style={styles.scanCompleteSummary}>{scanSummary}</Text>
              <TouchableOpacity
                style={styles.endButton}
                onPress={() => {
                  disconnectAI();
                  navigation.goBack();
                }}
              >
                <Text style={styles.endButtonText}>End & View Results</Text>
              </TouchableOpacity>
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
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  topLeft: {
    flexDirection: 'row',
    gap: 8,
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
  badgeOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  badgeText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  badgeSmallText: {
    color: 'white',
    fontSize: 12,
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
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  overlayMessage: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  overlayCode: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 32,
    backgroundColor: 'rgba(0,0,0,0.7)',
    gap: 12,
  },
  textInputContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: 'white',
    fontSize: 14,
  },
  sendButton: {
    backgroundColor: '#3B82F6',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotConnected: {
    backgroundColor: '#10B981',
  },
  statusDotConnecting: {
    backgroundColor: '#F59E0B',
  },
  statusDotDisconnected: {
    backgroundColor: '#6B7280',
  },
  statusText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  violationsCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 8,
    backgroundColor: 'rgba(245,158,11,0.2)',
    borderRadius: 8,
  },
  violationsText: {
    color: '#F59E0B',
    fontSize: 12,
  },
  transcriptContainer: {
    maxHeight: 100,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    padding: 12,
  },
  transcriptText: {
    fontSize: 12,
    marginBottom: 4,
  },
  transcriptUser: {
    color: '#60A5FA',
  },
  transcriptAssistant: {
    color: 'white',
  },
  scanCompleteContainer: {
    backgroundColor: 'rgba(16,185,129,0.2)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  scanCompleteTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: '700',
  },
  scanCompleteSummary: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    textAlign: 'center',
  },
  endButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 999,
    marginTop: 8,
  },
  endButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
});
