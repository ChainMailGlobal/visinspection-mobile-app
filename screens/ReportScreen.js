import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Share } from 'react-native';
import { Button } from 'react-native-paper';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ReportScreen({ route, navigation }) {
  const [generating, setGenerating] = useState(false);
  const [reportUri, setReportUri] = useState(null);

  const inspectionData = route?.params || {};
  const { photos = [], defects = [], location, jurisdiction, duration } = inspectionData;

  const generatePDFReport = async () => {
    setGenerating(true);
    try {
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
    <div class="title">VIS Eyesight Inspection Report</div>
    <div class="subtitle">Build Right As You Go - AI-Powered Visual Inspection</div>
  </div>

  <div class="section">
    <div class="section-title">Inspection Details</div>
    <div class="info-grid">
      <div class="info-label">Date:</div>
      <div class="info-value">${new Date().toLocaleString()}</div>

      <div class="info-label">Jurisdiction:</div>
      <div class="info-value">${jurisdiction || 'Honolulu Building Code'}</div>

      ${location ? `
      <div class="info-label">Location:</div>
      <div class="info-value">Lat: ${location.latitude?.toFixed(6)}, Lng: ${location.longitude?.toFixed(6)}</div>
      ` : ''}

      <div class="info-label">Duration:</div>
      <div class="info-value">${duration ? Math.floor(duration / 60000) + ' minutes' : 'N/A'}</div>

      <div class="info-label">Photos Captured:</div>
      <div class="info-value">${photos.length}</div>

      <div class="info-label">Defects Marked:</div>
      <div class="info-value">${defects.length}</div>
    </div>
  </div>

  ${defects.length > 0 ? `
  <div class="section">
    <div class="section-title">Defects & Issues Found (${defects.length})</div>
    ${defects.map((defect, index) => `
      <div class="defect-card">
        <div class="defect-title">Defect ${index + 1}: ${defect.category || 'General'}</div>
        <div class="defect-category">Severity: ${(defect.severity || 'yellow').toUpperCase()}</div>
        <div class="defect-category">Time: ${new Date(defect.timestamp).toLocaleTimeString()}</div>
        ${defect.issues && defect.issues.length > 0 ? `
          <div style="margin-top: 10px;">
            <strong>Issues:</strong>
            ${defect.issues.map(issue => `
              <div class="defect-issue">• ${issue}</div>
            `).join('')}
          </div>
        ` : ''}
        ${defect.note ? `
          <div style="margin-top: 10px;">
            <strong>Notes:</strong> ${defect.note}
          </div>
        ` : ''}
        ${defect.category !== 'General' ? `
          <div class="permit-box">
            <div class="permit-title">Permit Required: ${getPermitType(defect.category)}</div>
            <div>${getPermitNotes(defect.category)}</div>
          </div>
        ` : ''}
      </div>
    `).join('')}
  </div>
  ` : `
  <div class="section">
    <div class="section-title">Defects & Issues Found</div>
    <p style="color: #00CC66; font-weight: bold;">✓ No issues detected during inspection</p>
  </div>
  `}

  <div class="section">
    <div class="section-title">Code Compliance Summary</div>
    <p>This inspection was performed against <strong>${jurisdiction || 'Honolulu Building Code'}</strong> requirements.</p>
    <p>${defects.length === 0
      ? 'All inspected areas appear to comply with building code requirements.'
      : `${defects.length} potential issue${defects.length > 1 ? 's' : ''} identified that may require attention.`
    }</p>
  </div>

  <div class="footer">
    Generated with <strong>VIS Eyesight</strong> - AI-Powered Visual Inspection Platform<br/>
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
        'Report Generated',
        'Your inspection report has been created.',
        [
          { text: 'View', onPress: () => viewReport(uri) },
          { text: 'Share', onPress: () => shareReport(uri) },
          { text: 'OK' }
        ]
      );
    } catch (error) {
      console.error('PDF generation error:', error);
      Alert.alert('Error', 'Failed to generate report. Please try again.');
      setGenerating(false);
    }
  };

  const getPermitType = (category) => {
    const permits = {
      electrical: 'Electrical Permit',
      plumbing: 'Plumbing Permit',
      structural: 'Building Permit',
      'fire safety': 'Fire Safety Permit',
      HVAC: 'Mechanical Permit',
    };
    return permits[category] || 'Permit may be required';
  };

  const getPermitNotes = (category) => {
    const notes = {
      electrical: 'All electrical work requires permit per Honolulu Building Code',
      plumbing: 'All plumbing alterations require permit per Honolulu Building Code',
      structural: 'Structural work requires building permit and engineer approval',
      'fire safety': 'Fire protection systems require Fire Department approval',
      HVAC: 'HVAC installation requires mechanical permit',
    };
    return notes[category] || 'Check with City & County of Honolulu';
  };

  const viewReport = async (uri) => {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri);
    }
  };

  const shareReport = async (uri) => {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Share Inspection Report',
      });
    }
  };

  const deleteReport = () => {
    Alert.alert(
      'Delete Report',
      'Are you sure you want to delete this inspection data?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            navigation.replace('Home');
          }
        }
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Generate Report</Text>
        <Text style={styles.subtitle}>Auto-generated inspection documentation</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Inspection Summary</Text>
          <Text style={styles.summaryText}>Photos: {photos.length}</Text>
          <Text style={styles.summaryText}>Defects: {defects.length}</Text>
          <Text style={styles.summaryText}>Jurisdiction: {jurisdiction || 'Honolulu'}</Text>
        </View>

        <TouchableOpacity
          style={styles.generateButton}
          onPress={generatePDFReport}
          disabled={generating}
        >
          <Text style={styles.generateButtonText}>
            {generating ? 'GENERATING PDF...' : 'CREATE PDF REPORT'}
          </Text>
        </TouchableOpacity>

        {reportUri && (
          <>
            <TouchableOpacity style={styles.actionButton} onPress={() => viewReport(reportUri)}>
              <Text style={styles.actionButtonText}>VIEW REPORT</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={() => shareReport(reportUri)}>
              <Text style={styles.actionButtonText}>SHARE REPORT</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionButton, styles.deleteButton]} onPress={deleteReport}>
              <Text style={styles.actionButtonText}>DELETE</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Report Includes</Text>
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            • All inspection photos with GPS tags{'\n'}
            • AI-detected discrepancies{'\n'}
            • Code compliance notes{'\n'}
            • Voice-recorded defect marks{'\n'}
            • Permit requirements for each category{'\n'}
            • Professional formatting
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
  summaryCard: {
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  summaryText: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 6,
  },
  generateButton: {
    backgroundColor: '#0066CC',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionButton: {
    backgroundColor: '#00CC66',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
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
