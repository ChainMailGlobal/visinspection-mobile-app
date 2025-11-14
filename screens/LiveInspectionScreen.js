/**
 * LiveInspectionScreen - Clean, working camera screen
 * Minimal implementation that actually works
 */

import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Camera } from "expo-camera";
import { StatusBar } from "expo-status-bar";
import { MaterialIcons } from "@expo/vector-icons";

export default function LiveInspectionScreen({ route, navigation }) {
  const [permission, requestPermission] = Camera.useCameraPermissions();
  const [isScanning, setIsScanning] = useState(false);
  const cameraRef = useRef(null);

  // Request permission on mount if needed
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission]);

  // Show permission request screen
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
          <Text style={styles.permissionText}>Camera permission required</Text>
          <Text style={styles.permissionSubtext}>
            Please grant camera permission to use live AI inspection
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestPermission}
          >
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Main camera view
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Camera ref={cameraRef} style={styles.camera} facing="back">
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialIcons name="close" size={32} color="white" />
          </TouchableOpacity>
        </View>

        {/* Bottom controls */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[
              styles.controlButton,
              isScanning && styles.controlButtonActive,
            ]}
            onPress={() => setIsScanning(!isScanning)}
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
            onPress={async () => {
              if (!cameraRef.current) return;
              try {
                const photo = await cameraRef.current.takePictureAsync();
                Alert.alert("Photo Captured", "Photo saved successfully");
              } catch (error) {
                Alert.alert("Error", "Failed to capture photo");
              }
            }}
          >
            <MaterialIcons name="camera" size={32} color="white" />
            <Text style={styles.controlText}>CAPTURE</Text>
          </TouchableOpacity>
        </View>
      </Camera>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  camera: {
    flex: 1,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: "center",
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
  topBar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    padding: 16,
    paddingTop: 50,
  },
  closeButton: {
    padding: 4,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 16,
    paddingBottom: 40,
    backgroundColor: "rgba(0,0,0,0.8)",
  },
  controlButton: {
    flex: 1,
    backgroundColor: "rgba(59,130,246,0.9)",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginHorizontal: 8,
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
});
