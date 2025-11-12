/**
 * LiveInspectionScreen - Real-time AI code inspection with violation overlay
 * Button controls only - No voice recognition
 * Features: REST overlays, GPS auto-project, inspection types, video recording
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Camera } from 'expo-camera';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import * as ImageManipulator from 'expo-image-manipulator';
import VoiceService from '../services/VoiceService';
import { analyzeLiveInspection } from '../services/McpClient';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/env';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const INSPECTION_TYPES = [
  { id: 'building', label: 'Building/Structural', icon: 'business' },
  { id: 'electrical', label: 'Electrical', icon: 'bolt' },
  { id: 'plumbing', label: 'Plumbing', icon: 'water-drop' },
  { id: 'fire', label: 'Fire Safety', icon: 'local-fire-department' },
  { id: 'hvac', label: 'HVAC', icon: 'ac-unit' },
];

export default function LiveInspectionScreen({ route, navigation }) {
  const { projectId: existingProjectId } = route.params || {};

  const cameraRef = useRef(null);
  const frameIntervalRef = useRef(null);
  const sessionIdRef = useRef(null);
  const analyzingRef = useRef(false); // Use ref to prevent stale closure

  const [permission, requestPermission] = Camera.useCameraPermissions();
  const [locationPerm, requestLocationPerm] = Location.useForegroundPermissions();
  const [isScanning, setIsScanning] = useState(false);
  const [violations, setViolations] = useState([]);
  const [overlays, setOverlays] = useState([]);
  const [analyzing, setAnalyzing] = useState(false); // Keep for UI display
  const [projectId, setProjectId] = useState(existingProjectId);
  const [projectAddress, setProjectAddress] = useState('');
  const [inspectionType, setInspectionType] = useState('building');
  const [showTypePicker, setShowTypePicker] = useState(!existingProjectId);

  // GPS Auto-Project Creation
  useEffect(() => {
    if (!existingProjectId && locationPerm?.granted) {
      createProjectFromGPS();
    }
  }, [locationPerm]);

  // Cleanup camera when component unmounts
  useEffect(() => {
    return () => {
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
      }
      analyzingRef.current = false;
    };
  }, []);

  // Stop scanning when screen loses focus (user navigates away or backgrounds app)
  useFocusEffect(
    React.useCallback(() => {
      return () => {
        stopScanning();
      };
    }, [])
  );

  const createProjectFromGPS = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const [geocode] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      const address = geocode
        ? `${geocode.street || ''}, ${geocode.city || ''}, ${geocode.region || ''}`
        : `${location.coords.latitude.toFixed(6)}, ${location.coords.longitude.toFixed(6)}`;

      setProjectAddress(address);

      // Create project in Supabase
      const { data: user } = await supabase.auth.getUser();
      if (user.user) {
        const { data: project } = await supabase
          .from('projects')
          .insert({
            name: `Inspection - ${address}`,
            address,
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            user_id: user.user.id,
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (project) {
          setProjectId(project.id);
          console.log('✅ Auto-created project:', project.id);
        }
      }
    } catch (error) {
      console.error('GPS project creation failed:', error);
      setProjectAddress('Unknown Location');
    }
  };

  const startScanning = async () => {
    if (isScanning) return;

    // Create inspection session
    const { data: user } = await supabase.auth.getUser();
    if (user.user && projectId) {
      const { data: session } = await supabase
        .from('inspection_sessions')
        .insert({
          project_id: projectId,
          user_id: user.user.id,
          inspection_type: inspectionType,
          status: 'in_progress',
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      sessionIdRef.current = session?.id;
    }

    setIsScanning(true);

    const captureAndAnalyze = async () => {
      if (!cameraRef.current || analyzingRef.current) return;

      try {
        analyzingRef.current = true;
        setAnalyzing(true);

        // Capture frame
        const photo = await cameraRef.current.takePictureAsync({
          base64: true,
          quality: 0.6,
          skipProcessing: true,
        });

        // Resize for faster upload
        const resized = await ImageManipulator.manipulateAsync(
          photo.uri,
          [{ resize: { width: 960 } }],
          { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );

        // Call MCP REST endpoint
        const result = await analyzeLiveInspection({
          projectId: projectId || 'unknown',
          projectName: projectAddress || 'Unknown',
          frame_b64: resized.base64,
          inspectionType,
        });

        // Update overlays
        if (result.overlays && result.overlays.length > 0) {
          const newOverlays = result.overlays.slice(0, 3).map((overlay, idx) => ({
            id: Date.now() + idx,
            text: overlay.text || overlay.description || 'Violation',
            severity: overlay.severity || 'major',
            code: overlay.code_reference || 'Code Unknown',
            x: typeof overlay.x === 'number' ? overlay.x : 0.1,
            y: typeof overlay.y === 'number' ? overlay.y : 0.6 + idx * 0.1,
          }));

          setOverlays(newOverlays);
          setViolations(prev => [...prev, ...newOverlays]);

          // Speak first violation
          if (result.narration) {
            VoiceService.speak(result.narration);
          } else if (newOverlays[0]) {
            VoiceService.speak(`${newOverlays[0].severity} violation: ${newOverlays[0].text}`);
          }

          // Save violations to database
          saveViolations(newOverlays);
        } else {
          setOverlays([]);
        }

        analyzingRef.current = false;
        setAnalyzing(false);
      } catch (error) {
        console.error('Analysis error:', error);
        analyzingRef.current = false;
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

    // Update session status
    if (sessionIdRef.current) {
      supabase
        .from('inspection_sessions')
        .update({ status: 'completed', ended_at: new Date().toISOString() })
        .eq('id', sessionIdRef.current)
        .then(() => console.log('✅ Session completed'));
    }
  };

  const saveViolations = async (newViolations) => {
    if (!sessionIdRef.current) return;

    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;

    const records = newViolations.map(v => ({
      session_id: sessionIdRef.current,
      project_id: projectId,
      user_id: user.user.id,
      violation_description: v.text,
      code_reference: v.code,
      severity: v.severity,
      created_at: new Date().toISOString(),
    }));

    await supabase.from('inspection_violations').insert(records);
  };

  const captureViolation = async () => {
    if (!cameraRef.current) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 1 });

      const { data: user } = await supabase.auth.getUser();
      if (user.user && projectId) {
        await supabase.from('captured_violations').insert({
          project_id: projectId,
          session_id: sessionIdRef.current,
          user_id: user.user.id,
          photo_url: photo.uri,
          violation_description: 'Manually flagged',
          severity: 'warning',
          created_at: new Date().toISOString(),
        });

        VoiceService.speak('Violation captured');
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
        { text: 'Continue Scanning', style: 'cancel', onPress: () => startScanning() },
        {
          text: 'Generate PDF Report',
          onPress: async () => {
            navigation.navigate('Report', {
              projectId,
              sessionId: sessionIdRef.current,
              violations,
            });
          },
        },
      ]
    );
  };

  const selectInspectionType = (type) => {
    setInspectionType(type);
    setShowTypePicker(false);
    if (!locationPerm?.granted) {
      requestLocationPerm();
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical':
        return '#EF4444';
      case 'major':
        return '#F59E0B';
      case 'minor':
        return '#FCD34D';
      default:
        return '#3B82F6';
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

      {/* Inspection Type Picker Modal */}
      <Modal visible={showTypePicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Inspection Type</Text>
            {INSPECTION_TYPES.map(type => (
              <TouchableOpacity
                key={type.id}
                style={styles.typeButton}
                onPress={() => selectInspectionType(type.id)}
              >
                <MaterialIcons name={type.icon} size={24} color="#3B82F6" />
                <Text style={styles.typeButtonText}>{type.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      <Camera ref={cameraRef} style={styles.camera} facing="back">
        {/* Top Bar */}
        <View style={styles.topBar}>
          <View style={styles.badge}>
            <MaterialIcons name="place" size={16} color="white" />
            <Text style={styles.badgeText}>
              {projectAddress || 'Getting location...'}
            </Text>
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

        {/* Inspection Type Badge */}
        <View style={styles.typeBadge}>
          <Text style={styles.typeBadgeText}>
            {INSPECTION_TYPES.find(t => t.id === inspectionType)?.label || 'Building'}
          </Text>
        </View>

        {/* AR Violation Overlays */}
        <View style={styles.overlaysContainer}>
          {overlays.map(overlay => (
            <View
              key={overlay.id}
              style={[
                styles.overlay,
                {
                  backgroundColor: getSeverityColor(overlay.severity) + 'F0',
                  borderColor: getSeverityColor(overlay.severity),
                  left: `${overlay.x * 100}%`,
                  top: `${overlay.y * 100}%`,
                },
              ]}
            >
              <View style={styles.overlayHeader}>
                <MaterialIcons name="warning" size={18} color="white" />
                <Text style={styles.overlayCode}>{overlay.code}</Text>
              </View>
              <Text style={styles.overlayMessage}>{overlay.text}</Text>
            </View>
          ))}
        </View>

        {/* Bottom Controls */}
        <View style={styles.bottomBar}>
          <View style={styles.controls}>
            <TouchableOpacity
              style={[styles.controlButton, isScanning && styles.controlButtonActive]}
              onPress={isScanning ? stopScanning : startScanning}
            >
              <MaterialIcons name={isScanning ? 'pause' : 'play-arrow'} size={32} color="white" />
              <Text style={styles.controlText}>{isScanning ? 'PAUSE' : 'SCAN'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.controlButton} onPress={captureViolation}>
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

          {violations.length > 0 && (
            <View style={styles.counter}>
              <Text style={styles.counterText}>
                {violations.length} violation{violations.length !== 1 ? 's' : ''} found
              </Text>
            </View>
          )}

          {analyzing && (
            <View style={styles.analyzingBox}>
              <ActivityIndicator size="small" color="white" />
              <Text style={styles.analyzingText}>Analyzing with AI...</Text>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    marginBottom: 12,
    gap: 12,
  },
  typeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
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
    fontSize: 11,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  typeBadge: {
    position: 'absolute',
    top: 100,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  typeBadgeText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  overlaysContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  overlay: {
    position: 'absolute',
    padding: 12,
    borderRadius: 10,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 10,
    maxWidth: '70%',
  },
  overlayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  overlayCode: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  overlayMessage: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
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
