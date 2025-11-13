/**
 * LiveInspectionScreen - Real-time AI code inspection with violation overlay
 * Button controls only - No voice recognition
 * Features: REST overlays, GPS auto-project, inspection types, video recording
 */

import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
} from "react-native";
import { Camera } from "expo-camera";
import { StatusBar } from "expo-status-bar";
import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as Location from "expo-location";
import VoiceService from "../services/VoiceService";
import AIVisionService from "../services/AIVisionService";
import { health } from "../services/McpClient";
import getSupabaseClient from "../services/supabaseClient";

const INSPECTION_TYPES = [
  { id: "building", label: "Building/Structural", icon: "business" },
  { id: "electrical", label: "Electrical", icon: "bolt" },
  { id: "plumbing", label: "Plumbing", icon: "water-drop" },
  { id: "fire", label: "Fire Safety", icon: "local-fire-department" },
  { id: "hvac", label: "HVAC", icon: "ac-unit" },
];

export default function LiveInspectionScreen({ route, navigation }) {
  const { projectId: existingProjectId } = route.params || {};

  const cameraRef = useRef(null);
  const frameIntervalRef = useRef(null);
  const sessionIdRef = useRef(null);
  const analyzingRef = useRef(false); // Use ref to prevent stale closure
  const consecutiveErrorsRef = useRef(0); // Track consecutive errors for backoff
  const isMountedRef = useRef(true); // Track if component is mounted to prevent state updates after unmount

  // Get camera and location permissions (hooks must be called unconditionally)
  const [permission, requestPermission] = Camera.useCameraPermissions();
  const [locationPerm, requestLocationPerm] =
    Location.useForegroundPermissions();
  const [isScanning, setIsScanning] = useState(false);
  const [violations, setViolations] = useState([]);
  const [overlays, setOverlays] = useState([]);
  const [analyzing, setAnalyzing] = useState(false); // Keep for UI display
  const [projectId, setProjectId] = useState(existingProjectId);
  const [projectAddress, setProjectAddress] = useState("");
  const [inspectionType, setInspectionType] = useState("building");
  const [showTypePicker, setShowTypePicker] = useState(!existingProjectId);

  // GPS Auto-Project Creation
  useEffect(() => {
    if (!existingProjectId && locationPerm?.granted) {
      createProjectFromGPS().catch((error) => {
        console.error("Failed to create project from GPS:", error);
        // Don't crash - just log the error
      });
    }
  }, [locationPerm, existingProjectId]);

  // Cleanup camera when component unmounts
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false; // Mark as unmounted
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
      }
      analyzingRef.current = false;
      // Stop camera if still active
      if (cameraRef.current) {
        // Camera will be cleaned up by React Native, but we mark it
        cameraRef.current = null;
      }
    };
  }, []);

  // Stop scanning when screen loses focus (user navigates away or backgrounds app)
  useFocusEffect(
    React.useCallback(() => {
      return () => {
        // Stop scanning when leaving screen
        if (frameIntervalRef.current) {
          clearInterval(frameIntervalRef.current);
          frameIntervalRef.current = null;
        }
        setIsScanning(false);
        consecutiveErrorsRef.current = 0;
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
        ? `${geocode.street || ""}, ${geocode.city || ""}, ${
            geocode.region || ""
          }`
        : `${location.coords.latitude.toFixed(
            6
          )}, ${location.coords.longitude.toFixed(6)}`;

      setProjectAddress(address);

      // Create project in Supabase
      const supabase = getSupabaseClient();
      const { data: user, error: userError } = await supabase.auth.getUser();

      if (userError) {
        console.error("Failed to get user:", userError);
        if (isMountedRef.current) {
          setProjectAddress("Unknown Location (Auth Error)");
        }
        return;
      }

      if (user?.user?.id) {
        const { data: project, error: projectError } = await supabase
          .from("projects")
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

        if (projectError) {
          console.error("Failed to create project:", projectError);
        } else if (project && isMountedRef.current) {
          setProjectId(project.id);
          console.log("✅ Auto-created project:", project.id);
        }
      } else if (isMountedRef.current) {
        // Guest mode or no user
        setProjectAddress(address);
      }
    } catch (error) {
      console.error("GPS project creation failed:", error);
      setProjectAddress("Unknown Location");
    }
  };

  const startScanning = async () => {
    if (isScanning) return;

    try {
      // Check MCP backend health before starting
      const healthStatus = await health();
      if (healthStatus !== 200) {
        Alert.alert(
          "Connection Error",
          "Cannot connect to AI inspection service. Please check your internet connection and try again.",
          [{ text: "OK" }]
        );
        return;
      }

      // Create inspection session
      const supabase = getSupabaseClient();
      const { data: user, error: userError } = await supabase.auth.getUser();

      if (!userError && user?.user?.id && projectId) {
        const { data: session, error: sessionError } = await supabase
          .from("inspection_sessions")
          .insert({
            project_id: projectId,
            user_id: user.user.id,
            inspection_type: inspectionType,
            status: "in_progress",
            started_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (sessionError) {
          console.error("Failed to create session:", sessionError);
        } else if (session?.id) {
          sessionIdRef.current = session.id;
        }
      }

      setIsScanning(true);
      consecutiveErrorsRef.current = 0; // Reset error counter when starting new scan

      const captureAndAnalyze = async () => {
        if (!cameraRef.current || analyzingRef.current || !isMountedRef.current)
          return;

        try {
          analyzingRef.current = true;
          if (isMountedRef.current) {
            setAnalyzing(true);
          }

          // Capture frame with reduced quality to minimize memory usage
          const photo = await cameraRef.current.takePictureAsync({
            quality: 0.5,
            skipProcessing: true,
          });

          // Analyze with AIVisionService (has race condition fixes, OpenAI fallback, retry logic)
          const result = await AIVisionService.analyzeFrame(photo.uri, {
            projectId: projectId || "unknown",
            projectName: projectAddress || "Unknown",
            inspectionType,
            sessionId: sessionIdRef.current,
          });

          // Reset error counter on success
          consecutiveErrorsRef.current = 0;

          // Check if still mounted before updating state
          if (!isMountedRef.current) return;

          // Update overlays from AIVisionService violations
          if (result.violations && result.violations.length > 0) {
            const newOverlays = result.violations
              .slice(0, 3)
              .map((violation, idx) => ({
                id: violation.id || `${Date.now()}_${idx}`,
                text: violation.issue || violation.text || "Violation detected",
                severity: violation.severity || "medium",
                code: violation.code || "Code Unknown",
                x: 0.1,
                y: 0.6 + idx * 0.1,
              }));

            setOverlays(newOverlays);
            // Limit violations array to prevent memory leak (keep last 100)
            setViolations((prev) => {
              const updated = [...prev, ...newOverlays];
              return updated.slice(-100); // Keep only last 100 violations
            });

            // Speak narration from AIVisionService
            if (result.narration) {
              VoiceService.speak(result.narration);
            } else if (newOverlays[0]) {
              VoiceService.speak(
                `${newOverlays[0].severity} violation: ${newOverlays[0].text}`
              );
            }

            // Save violations to database
            saveViolations(newOverlays);
          } else {
            if (isMountedRef.current) {
              setOverlays([]);
            }
          }

          analyzingRef.current = false;
          if (isMountedRef.current) {
            setAnalyzing(false);
          }
        } catch (error) {
          console.error("Analysis error:", error);
          analyzingRef.current = false;

          // Only update state if component is still mounted
          if (isMountedRef.current) {
            setAnalyzing(false);
          }

          // Increment error counter
          consecutiveErrorsRef.current += 1;

          // If too many consecutive errors, stop scanning and alert user
          if (consecutiveErrorsRef.current >= 5 && isMountedRef.current) {
            stopScanning();
            Alert.alert(
              "Connection Lost",
              "Lost connection to AI inspection service after multiple attempts. Please check your connection and try again.",
              [{ text: "OK" }]
            );
            consecutiveErrorsRef.current = 0;
          }
        }
      };

      // Analyze every 4 seconds (reduced from 2s to minimize memory pressure)
      // Wrap interval calls to prevent unhandled promise rejections from crashing the app
      frameIntervalRef.current = setInterval(async () => {
        try {
          await captureAndAnalyze();
        } catch (error) {
          console.error("Frame analysis failed, skipping frame:", error);
          // Don't crash, just skip this frame and continue
        }
      }, 4000);

      // First frame immediately (also wrapped)
      (async () => {
        try {
          await captureAndAnalyze();
        } catch (error) {
          console.error("Initial frame analysis failed:", error);
        }
      })();
    } catch (error) {
      console.error("❌ Start scanning failed:", error);
      Alert.alert(
        "Failed to Start",
        error.message || "Could not start AI inspection. Please try again.",
        [{ text: "OK" }]
      );
    }
  };

  const stopScanning = () => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    setIsScanning(false);
    consecutiveErrorsRef.current = 0; // Reset error counter when stopping

    // Update session status
    if (sessionIdRef.current) {
      const supabase = getSupabaseClient();
      supabase
        .from("inspection_sessions")
        .update({ status: "completed", ended_at: new Date().toISOString() })
        .eq("id", sessionIdRef.current)
        .then(() => console.log("✅ Session completed"))
        .catch((error) =>
          console.error("Failed to update session status:", error)
        );
    }
  };

  const saveViolations = async (newViolations) => {
    if (!sessionIdRef.current || !isMountedRef.current) return;

    try {
      const supabase = getSupabaseClient();
      const { data: user, error: userError } = await supabase.auth.getUser();

      if (userError || !user?.user?.id) {
        console.warn("Cannot save violations: user not authenticated");
        return;
      }

      const records = newViolations.map((v) => ({
        session_id: sessionIdRef.current,
        project_id: projectId,
        user_id: user.user.id,
        violation_description: v.text,
        code_reference: v.code,
        severity: v.severity,
        created_at: new Date().toISOString(),
      }));

      const { error: insertError } = await supabase
        .from("inspection_violations")
        .insert(records);

      if (insertError) {
        console.error("Failed to save violations:", insertError);
      }
    } catch (error) {
      console.error("Error saving violations:", error);
      // Don't throw - this is non-critical
    }
  };

  const captureViolation = async () => {
    if (!cameraRef.current || !isMountedRef.current) return;

    // Check permission before capturing
    if (!permission?.granted) {
      Alert.alert(
        "Permission Required",
        "Camera permission is required to capture violations."
      );
      return;
    }

    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 1 });

      if (!isMountedRef.current) return; // Check again after async operation

      const supabase = getSupabaseClient();
      const { data: user, error: userError } = await supabase.auth.getUser();

      if (!userError && user?.user?.id && projectId) {
        const { error: insertError } = await supabase
          .from("captured_violations")
          .insert({
            project_id: projectId,
            session_id: sessionIdRef.current,
            user_id: user.user.id,
            photo_url: photo.uri,
            violation_description: "Manually flagged",
            severity: "warning",
            created_at: new Date().toISOString(),
          });

        if (insertError) {
          console.error("Failed to save violation photo:", insertError);
          Alert.alert(
            "Error",
            "Failed to save violation photo. Please try again."
          );
        } else if (isMountedRef.current) {
          VoiceService.speak("Violation captured").catch((err) =>
            console.error("Speech error:", err)
          );
          Alert.alert("✓ Captured", "Violation photo saved");
        }
      } else if (isMountedRef.current) {
        Alert.alert(
          "Error",
          "Cannot save violation. Please ensure you are logged in."
        );
      }
    } catch (error) {
      console.error("Capture error:", error);
      if (isMountedRef.current) {
        Alert.alert("Error", "Failed to capture photo. Please try again.");
      }
    }
  };

  const finishInspection = () => {
    stopScanning();

    Alert.alert(
      "✅ Inspection Complete",
      `Found ${violations.length} potential violation${
        violations.length !== 1 ? "s" : ""
      }`,
      [
        {
          text: "Continue Scanning",
          style: "cancel",
          onPress: () => startScanning(),
        },
        {
          text: "Generate PDF Report",
          onPress: async () => {
            navigation.navigate("Report", {
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
    // Request location permission if not granted
    if (!locationPerm?.granted && requestLocationPerm) {
      requestLocationPerm().catch((err) => {
        console.error("Failed to request location permission:", err);
      });
    }
    // Request camera permission if not granted
    if (!permission?.granted && requestPermission) {
      requestPermission().catch((err) => {
        console.error("Failed to request camera permission:", err);
      });
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case "critical":
        return "#EF4444";
      case "major":
        return "#F59E0B";
      case "minor":
        return "#FCD34D";
      default:
        return "#3B82F6";
    }
  };

  // Check camera permissions before rendering
  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0066CC" />
        <Text style={styles.loadingText}>Checking permissions...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <MaterialIcons name="camera-alt" size={64} color="#CCCCCC" />
          <Text style={styles.permissionText}>
            Camera permission is required
          </Text>
          <Text style={styles.permissionSubtext}>
            Please grant camera permission to use live AI inspection
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={() => {
              if (requestPermission) {
                requestPermission().catch((err) => {
                  console.error("Permission request failed:", err);
                  Alert.alert(
                    "Permission Error",
                    "Failed to request camera permission. Please enable it in device settings."
                  );
                });
              }
            }}
          >
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Safety check - ensure all required refs and state are initialized
  if (typeof cameraRef === "undefined" || typeof isMountedRef === "undefined") {
    console.error("LiveInspectionScreen: Critical refs not initialized");
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Initializing...</Text>
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
            {INSPECTION_TYPES.map((type) => (
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
              {projectAddress || "Getting location..."}
            </Text>
          </View>

          {isScanning && (
            <View
              style={[
                styles.badge,
                { backgroundColor: "#10B981", marginLeft: 8 },
              ]}
            >
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
            {INSPECTION_TYPES.find((t) => t.id === inspectionType)?.label ||
              "Building"}
          </Text>
        </View>

        {/* AR Violation Overlays */}
        <View style={styles.overlaysContainer}>
          {overlays.map((overlay) => (
            <View
              key={overlay.id}
              style={[
                styles.overlay,
                {
                  backgroundColor: getSeverityColor(overlay.severity) + "F0",
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
              style={[
                styles.controlButton,
                isScanning && styles.controlButtonActive,
              ]}
              onPress={isScanning ? stopScanning : startScanning}
            >
              <MaterialIcons
                name={isScanning ? "pause" : "play-arrow"}
                size={32}
                color="white"
              />
              <Text style={styles.controlText}>
                {isScanning ? "PAUSE" : "SCAN"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.controlButton}
              onPress={captureViolation}
            >
              <MaterialIcons name="flag" size={32} color="white" />
              <Text style={styles.controlText}>MARK</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlButton, { backgroundColor: "#10B981" }]}
              onPress={finishInspection}
            >
              <MaterialIcons name="check" size={32} color="white" />
              <Text style={styles.controlText}>DONE</Text>
            </TouchableOpacity>
          </View>

          {violations.length > 0 && (
            <View style={styles.counter}>
              <Text style={styles.counterText}>
                {violations.length} violation
                {violations.length !== 1 ? "s" : ""} found
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
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  camera: {
    flex: 1,
    width: "100%",
  },
  permissionContainer: {
    alignItems: "center",
    padding: 24,
  },
  permissionText: {
    color: "white",
    fontSize: 18,
    textAlign: "center",
    marginVertical: 20,
    fontWeight: "600",
  },
  permissionSubtext: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
  },
  permissionButton: {
    backgroundColor: "#0066CC",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  loadingText: {
    color: "white",
    fontSize: 16,
    marginTop: 16,
  },
  button: {
    backgroundColor: "#3B82F6",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 24,
    width: "85%",
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 20,
    textAlign: "center",
  },
  typeButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    marginBottom: 12,
    gap: 12,
  },
  typeButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111",
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 16,
    paddingTop: 50,
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(59,130,246,0.9)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  badgeText: {
    color: "white",
    fontSize: 11,
    fontWeight: "600",
  },
  closeButton: {
    padding: 4,
  },
  typeBadge: {
    position: "absolute",
    top: 100,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  typeBadgeText: {
    color: "white",
    fontSize: 14,
    fontWeight: "700",
  },
  overlaysContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  overlay: {
    position: "absolute",
    padding: 12,
    borderRadius: 10,
    borderWidth: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 10,
    maxWidth: "70%",
  },
  overlayHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  overlayCode: {
    color: "white",
    fontSize: 14,
    fontWeight: "700",
  },
  overlayMessage: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 40,
    backgroundColor: "rgba(0,0,0,0.8)",
    gap: 12,
  },
  controls: {
    flexDirection: "row",
    justifyContent: "space-around",
    gap: 12,
  },
  controlButton: {
    flex: 1,
    backgroundColor: "rgba(59,130,246,0.9)",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    gap: 4,
  },
  controlButtonActive: {
    backgroundColor: "rgba(245,158,11,0.9)",
  },
  controlText: {
    color: "white",
    fontSize: 12,
    fontWeight: "700",
  },
  counter: {
    backgroundColor: "rgba(239,68,68,0.3)",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  counterText: {
    color: "#FCA5A5",
    fontSize: 14,
    fontWeight: "600",
  },
  analyzingBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 8,
  },
  analyzingText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
  },
});
