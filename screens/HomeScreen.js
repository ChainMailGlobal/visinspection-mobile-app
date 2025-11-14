import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

export default function HomeScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>VISION</Text>
        <Text style={styles.subtitle}>Construction Inspection Platform</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: "#F59E0B" }]}
          onPress={() => navigation.navigate("LiveInspection")}
        >
          <MaterialIcons name="camera-alt" size={32} color="white" />
          <Text style={styles.actionButtonText}>Live AI</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: "#3B82F6" }]}
          onPress={() => navigation.navigate("BuildingCodes")}
        >
          <MaterialIcons name="description" size={32} color="white" />
          <Text style={styles.actionButtonText}>Foresight</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: "#10B981" }]}
          onPress={() => navigation.navigate("Diagnostics")}
        >
          <MaterialIcons name="bug-report" size={32} color="white" />
          <Text style={styles.actionButtonText}>Diagnostics</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    padding: 32,
    paddingTop: 80,
    alignItems: "center",
  },
  title: {
    fontSize: 48,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666666",
  },
  actions: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    gap: 16,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    borderRadius: 12,
    gap: 12,
  },
  actionButtonText: {
    color: "white",
    fontSize: 20,
    fontWeight: "600",
  },
});
