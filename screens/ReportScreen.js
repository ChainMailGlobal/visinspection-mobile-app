import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Share,
  ActivityIndicator,
} from "react-native";
import { Button } from "react-native-paper";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import AsyncStorage from "@react-native-async-storage/async-storage";
import getSupabaseClient from "../services/supabaseClient";

export default function ReportScreen({ route, navigation }) {
  const [generating, setGenerating] = useState(false);
  const [reportUri, setReportUri] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);

  const {
    projectId,
    sessionId,
    violations: routeViolations,
  } = route?.params || {};
  const inspectionData = route?.params || {};
  const {
    photos = [],
    defects = [],
    location,
    jurisdiction,
    duration,
  } = inspectionData;

  // Fetch report data from database if projectId/sessionId provided
  useEffect(() => {
    if (projectId && sessionId) {
      fetchReportData();
    } else if (routeViolations && routeViolations.length > 0) {
      // Use route params if available
      setReportData({
        violations: routeViolations,
        photos: photos || [],
        defects: defects || routeViolations,
      });
    }
  }, [projectId, sessionId]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();

      // Fetch session
      const { data: session } = await supabase
        .from("inspection_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

      // Fetch violations
      const { data: violations } = await supabase
        .from("inspection_violations")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false });

      // Fetch captured violations (photos)
      const { data: capturedViolations } = await supabase
        .from("captured_violations")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false });

      // Fetch project for location
      const { data: project } = projectId
        ? await supabase
            .from("projects")
            .select("*")
            .eq("id", projectId)
            .single()
        : { data: null };

      setReportData({
        session,
        violations: violations || [],
        capturedViolations: capturedViolations || [],
        project,
        photos: capturedViolations?.map((cv) => cv.photo_url) || [],
        defects:
          violations?.map((v) => ({
            category: v.severity,
            severity: v.severity,
            issues: [v.violation_description],
            code: v.code_reference,
            timestamp: v.created_at,
          })) || [],
        location: project
          ? {
              latitude: project.latitude,
              longitude: project.longitude,
            }
          : null,
        jurisdiction: "Honolulu Building Code",
        duration: session
          ? new Date(session.ended_at || Date.now()) -
            new Date(session.started_at)
          : null,
      });
    } catch (error) {
      console.error("Failed to fetch report data:", error);
      // Fall back to route params
      setReportData({
        violations: routeViolations || [],
        photos: photos || [],
        defects: defects || routeViolations || [],
      });
    } finally {
      setLoading(false);
    }
  };

  const generatePDFReport = async () => {
    setGenerating(true);
    try {
      // Use fetched data or fall back to route params
      const data = reportData || {
        photos: photos || [],
        defects: defects || routeViolations || [],
        location,
        jurisdiction: jurisdiction || "Honolulu Building Code",
        duration,
      };

      const finalPhotos = data.photos || photos || [];
      const finalDefects = data.defects || defects || routeViolations || [];
      const finalLocation = data.location || location;
      const finalJurisdiction =
        data.jurisdiction || jurisdiction || "Honolulu Building Code";
      const finalDuration = data.duration || duration;
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: Arial, sans-serif;
      padding: 20px;
      color: #1A1A1A;
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #0066CC;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .title {
      font-size: 28px;
      font-weight: bold;
      color: #0066CC;
      margin-bottom: 10px;
    }
    .subtitle {
      font-size: 14px;
      color: #666666;
    }
    .section {
      margin-bottom: 30px;
    }
    .section-title {
      font-size: 20px;
      font-weight: bold;
      color: #1A1A1A;
      border-bottom: 2px solid #E5E5E5;
      padding-bottom: 10px;
      margin-bottom: 15px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 150px 1fr;
      gap: 10px;
      margin-bottom: 20px;
    }
    .info-label {
      font-weight: bold;
      color: #666666;
    }
    .info-value {
      color: #1A1A1A;
    }
    .defect-card {
      background: #FFF8F0;
      border-left: 4px solid #FFA500;
      padding: 15px;
      margin-bottom: 15px;
      page-break-inside: avoid;
    }
    .defect-title {
      font-size: 16px;
      font-weight: bold;
      color: #FFA500;
      margin-bottom: 8px;
    }
    .defect-category {
      font-size: 14px;
      color: #666666;
      margin-bottom: 5px;
    }
    .defect-issue {
      font-size: 14px;
      color: #1A1A1A;
      margin-left: 15px;
      margin-bottom: 5px;
    }
    .permit-box {
      background: #F0F7FF;
      border: 1px solid #0066CC;
      border-radius: 8px;
      padding: 15px;
      margin-top: 10px;
    }
    .permit-title {
      font-size: 14px;
      font-weight: bold;
      color: #0066CC;
      margin-bottom: 5px;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #E5E5E5;
      text-align: center;
      font-size: 12px;
      color: #999999;
    }
    .footer strong {
      color: #0066CC;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">VISION Inspection Report</div>
    <div class="subtitle">Build Right As You Go - AI-Powered Visual Inspection</div>
  </div>

  <div class="section">
    <div class="section-title">Inspection Details</div>
    <div class="info-grid">
      <div class="info-label">Date:</div>
      <div class="info-value">${new Date().toLocaleString()}</div>

      <div class="info-label">Jurisdiction:</div>
      <div class="info-value">${finalJurisdiction}</div>

      ${
        finalLocation
          ? `
      <div class="info-label">Location:</div>
      <div class="info-value">${
        finalLocation.latitude
          ? `Lat: ${finalLocation.latitude.toFixed(
              6
            )}, Lng: ${finalLocation.longitude.toFixed(6)}`
          : finalLocation.address || "N/A"
      }</div>
      `
          : ""
      }

      <div class="info-label">Duration:</div>
      <div class="info-value">${
        finalDuration ? Math.floor(finalDuration / 60000) + " minutes" : "N/A"
      }</div>

      <div class="info-label">Photos Captured:</div>
      <div class="info-value">${finalPhotos.length}</div>

      <div class="info-label">Defects Marked:</div>
      <div class="info-value">${finalDefects.length}</div>
    </div>
  </div>

  ${
    finalDefects.length > 0
      ? `
  <div class="section">
    <div class="section-title">Defects & Issues Found (${
      finalDefects.length
    })</div>
    ${finalDefects
      .map(
        (defect, index) => `
      <div class="defect-card">
        <div class="defect-title">Defect ${index + 1}: ${
          defect.category || "General"
        }</div>
        <div class="defect-category">Severity: ${(
          defect.severity || "yellow"
        ).toUpperCase()}</div>
        <div class="defect-category">Time: ${new Date(
          defect.timestamp
        ).toLocaleTimeString()}</div>
        ${
          defect.issues && defect.issues.length > 0
            ? `
          <div style="margin-top: 10px;">
            <strong>Issues:</strong>
            ${defect.issues
              .map(
                (issue) => `
              <div class="defect-issue">• ${issue}</div>
            `
              )
              .join("")}
          </div>
        `
            : ""
        }
        ${
          defect.note
            ? `
          <div style="margin-top: 10px;">
            <strong>Notes:</strong> ${defect.note}
          </div>
        `
            : ""
        }
        ${
          defect.category !== "General"
            ? `
          <div class="permit-box">
            <div class="permit-title">Permit Required: ${getPermitType(
              defect.category
            )}</div>
            <div>${getPermitNotes(defect.category)}</div>
          </div>
        `
            : ""
        }
      </div>
    `
      )
      .join("")}
  </div>
  `
      : `
  <div class="section">
    <div class="section-title">Defects & Issues Found</div>
    <p style="color: #00CC66; font-weight: bold;">✓ No issues detected during inspection</p>
  </div>
  `
  }

  <div class="section">
    <div class="section-title">Code Compliance Summary</div>
    <p>This inspection was performed against <strong>${finalJurisdiction}</strong> requirements.</p>
    <p>${
      finalDefects.length === 0
        ? "All inspected areas appear to comply with building code requirements."
        : `${finalDefects.length} potential issue${
            finalDefects.length > 1 ? "s" : ""
          } identified that may require attention.`
    }</p>
  </div>

  <div class="footer">
    Generated with <strong>VISION</strong> - AI-Powered Visual Inspection Platform<br/>
    One prevented rework pays for the platform<br/>
    <em>This report is for informational purposes. Final compliance determination by licensed inspector.</em>
  </div>
</body>
</html>
      `;

      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      setReportUri(uri);
      setGenerating(false);

      Alert.alert(
        "Report Generated",
        "Your inspection report has been created.",
        [
          { text: "View", onPress: () => viewReport(uri) },
          { text: "Share", onPress: () => shareReport(uri) },
          { text: "OK" },
        ]
      );
    } catch (error) {
      console.error("PDF generation error:", error);
      Alert.alert("Error", "Failed to generate report. Please try again.");
      setGenerating(false);
    }
  };

  const getPermitType = (category) => {
    const permits = {
      electrical: "Electrical Permit",
      plumbing: "Plumbing Permit",
      structural: "Building Permit",
      "fire safety": "Fire Safety Permit",
      HVAC: "Mechanical Permit",
    };
    return permits[category] || "Permit may be required";
  };

  const getPermitNotes = (category) => {
    const notes = {
      electrical:
        "All electrical work requires permit per Honolulu Building Code",
      plumbing:
        "All plumbing alterations require permit per Honolulu Building Code",
      structural:
        "Structural work requires building permit and engineer approval",
      "fire safety": "Fire protection systems require Fire Department approval",
      HVAC: "HVAC installation requires mechanical permit",
    };
    return notes[category] || "Check with City & County of Honolulu";
  };

  const viewReport = async (uri) => {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri);
    }
  };

  const shareReport = async (uri) => {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: "Share Inspection Report",
      });
    }
  };

  const deleteReport = () => {
    Alert.alert(
      "Delete Report",
      "Are you sure you want to delete this inspection data?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            navigation.replace("Home");
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0066CC" />
          <Text style={styles.loadingText}>Loading report data...</Text>
        </View>
      </View>
    );
  }

  const displayData = reportData || {
    photos: photos || [],
    defects: defects || routeViolations || [],
    location,
    jurisdiction: jurisdiction || "Honolulu Building Code",
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Generate Report</Text>
        <Text style={styles.subtitle}>
          Auto-generated inspection documentation
        </Text>
      </View>

      <View style={styles.section}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Inspection Summary</Text>
          <Text style={styles.summaryText}>
            Photos: {displayData.photos?.length || 0}
          </Text>
          <Text style={styles.summaryText}>
            Defects: {displayData.defects?.length || 0}
          </Text>
          <Text style={styles.summaryText}>
            Jurisdiction: {displayData.jurisdiction || "Honolulu"}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.generateButton}
          onPress={generatePDFReport}
          disabled={generating}
        >
          <Text style={styles.generateButtonText}>
            {generating ? "GENERATING PDF..." : "CREATE PDF REPORT"}
          </Text>
        </TouchableOpacity>

        {reportUri && (
          <>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => viewReport(reportUri)}
            >
              <Text style={styles.actionButtonText}>VIEW REPORT</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => shareReport(reportUri)}
            >
              <Text style={styles.actionButtonText}>SHARE REPORT</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={deleteReport}
            >
              <Text style={styles.actionButtonText}>DELETE</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Report Includes</Text>
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            • All inspection photos with GPS tags{"\n"}• AI-detected
            discrepancies{"\n"}• Code compliance notes{"\n"}• Voice-recorded
            defect marks{"\n"}• Permit requirements for each category{"\n"}•
            Professional formatting
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#666666",
  },
  header: {
    padding: 24,
    backgroundColor: "#F8F8F8",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#666666",
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1A1A1A",
    marginBottom: 12,
  },
  summaryCard: {
    backgroundColor: "#F8F8F8",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1A1A1A",
    marginBottom: 12,
  },
  summaryText: {
    fontSize: 14,
    color: "#666666",
    marginBottom: 6,
  },
  generateButton: {
    backgroundColor: "#0066CC",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  actionButton: {
    backgroundColor: "#00CC66",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  deleteButton: {
    backgroundColor: "#FF3B30",
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  infoCard: {
    backgroundColor: "#F0F7FF",
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: "#0066CC",
  },
  infoText: {
    fontSize: 14,
    color: "#0066CC",
    lineHeight: 24,
  },
});
