/**
 * DiagnosticsScreen - Run comprehensive app diagnostics
 * Helps identify why Live AI mode won't launch
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import DiagnosticsService from '../services/DiagnosticsService';

export default function DiagnosticsScreen({ navigation }) {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState(null);
  const [expanded, setExpanded] = useState({});

  const runDiagnostics = async () => {
    setRunning(true);
    setResults(null);
    
    try {
      const summary = await DiagnosticsService.runAllDiagnostics();
      if (summary && typeof summary === 'object') {
        setResults(summary);
      } else {
        throw new Error('Invalid diagnostics results returned');
      }
    } catch (error) {
      console.error('Diagnostics failed:', error);
      Alert.alert(
        'Diagnostics Error',
        'Failed to run diagnostics: ' + (error.message || 'Unknown error') + '\n\nCheck console for details.',
        [{ text: 'OK' }]
      );
      // Set empty results so UI doesn't break
      setResults({
        summary: { total: 0, passed: 0, failed: 1, warnings: 0, errors: 1 },
        criticalIssues: [{ name: 'Diagnostics Error', message: error.message || 'Unknown error' }],
        allResults: [],
        timestamp: new Date().toISOString(),
      });
    } finally {
      setRunning(false);
    }
  };

  const toggleExpanded = (index) => {
    setExpanded(prev => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const shareReport = async () => {
    if (!results) {
      Alert.alert('No Results', 'Please run diagnostics first.');
      return;
    }
    
    try {
      const report = DiagnosticsService.getFormattedReport();
      await Share.share({
        message: report,
        title: 'VISION App Diagnostics Report',
      });
    } catch (error) {
      // Share can fail if user cancels - that's OK, don't show error
      if (error.message && !error.message.includes('cancel')) {
        console.error('Share failed:', error);
        Alert.alert(
          'Share Failed',
          'Could not share report. Error: ' + (error.message || 'Unknown error'),
          [{ text: 'OK' }]
        );
      }
    }
  };

  const copyToClipboard = async () => {
    if (!results) {
      Alert.alert('No Results', 'Please run diagnostics first.');
      return;
    }
    
    try {
      const report = DiagnosticsService.getFormattedReport();
      
      // Try to use Clipboard API (safe fallback if not available)
      try {
        const Clipboard = require('expo-clipboard');
        await Clipboard.setStringAsync(report);
        Alert.alert('Copied!', 'Diagnostics report copied to clipboard. You can paste it anywhere.');
      } catch (clipboardError) {
        // Fallback: Use Share API if Clipboard not available
        console.warn('Clipboard not available, using Share:', clipboardError);
        try {
          await Share.share({
            message: report,
            title: 'VISION Diagnostics Report',
          });
        } catch (shareError) {
          console.error('Share also failed:', shareError);
          Alert.alert(
            'Copy Unavailable',
            'Clipboard and Share are not available. Use "Log to Console" to view results in development console.',
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error) {
      console.error('Copy operation failed:', error);
      Alert.alert(
        'Error',
        'Could not copy report. Error: ' + (error.message || 'Unknown error'),
        [{ text: 'OK' }]
      );
    }
  };

  const copyJSONToClipboard = async () => {
    if (!results) {
      Alert.alert('No Results', 'Please run diagnostics first.');
      return;
    }
    
    try {
      const jsonReport = JSON.stringify(results, null, 2);
      
      // Try to use Clipboard API (safe fallback if not available)
      try {
        const Clipboard = require('expo-clipboard');
        await Clipboard.setStringAsync(jsonReport);
        Alert.alert('Copied!', 'Diagnostics JSON copied to clipboard.');
      } catch (clipboardError) {
        // Fallback: Use Share API if Clipboard not available
        console.warn('Clipboard not available, using Share:', clipboardError);
        try {
          await Share.share({
            message: jsonReport,
            title: 'VISION Diagnostics JSON',
          });
        } catch (shareError) {
          console.error('Share also failed:', shareError);
          Alert.alert(
            'Copy Unavailable',
            'Clipboard and Share are not available. Use "Log to Console" to view JSON in development console.',
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error) {
      console.error('JSON copy operation failed:', error);
      Alert.alert(
        'Error',
        'Could not copy JSON. Error: ' + (error.message || 'Unknown error'),
        [{ text: 'OK' }]
      );
    }
  };

  const logToConsole = () => {
    if (!results) {
      Alert.alert('No Results', 'Please run diagnostics first.');
      return;
    }
    
    try {
      const report = DiagnosticsService.getFormattedReport();
      
      // Safe console logging with error handling
      try {
        console.log('\n' + '='.repeat(50));
        console.log('VISION APP DIAGNOSTICS REPORT');
        console.log('='.repeat(50));
        console.log(report);
        console.log('\n' + '='.repeat(50));
        console.log('FULL JSON RESULTS:');
        console.log(JSON.stringify(results, null, 2));
        console.log('='.repeat(50) + '\n');
        
        Alert.alert(
          'Logged to Console',
          'Full diagnostics report has been logged to the console. Check your development console/logs to see the details.',
          [{ text: 'OK' }]
        );
      } catch (logError) {
        console.error('Console logging failed:', logError);
        // Still show alert even if console.log fails
        Alert.alert(
          'Logged to Console',
          'Report logged (some console output may have failed). Check your development console.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Log to console operation failed:', error);
      Alert.alert(
        'Error',
        'Could not log to console. Error: ' + (error.message || 'Unknown error'),
        [{ text: 'OK' }]
      );
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pass': return '#10B981';
      case 'fail': return '#EF4444';
      case 'warn': return '#F59E0B';
      case 'error': return '#DC2626';
      default: return '#6B7280';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pass': return 'check-circle';
      case 'fail': return 'error';
      case 'warn': return 'warning';
      case 'error': return 'cancel';
      default: return 'help';
    }
  };

  useEffect(() => {
    // Auto-run diagnostics on mount
    runDiagnostics();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.title}>App Diagnostics</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={copyToClipboard}
            disabled={!results}
          >
            <MaterialIcons name="content-copy" size={24} color={results ? "#0066CC" : "#CCCCCC"} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={shareReport}
            disabled={!results}
          >
            <MaterialIcons name="share" size={24} color={results ? "#0066CC" : "#CCCCCC"} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {running && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0066CC" />
            <Text style={styles.loadingText}>Running diagnostics...</Text>
          </View>
        )}

        {results && (
          <>
            {/* Summary Card */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Diagnostics Summary</Text>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryNumber}>{results.summary.passed}</Text>
                  <Text style={styles.summaryLabel}>Passed</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryNumber, { color: '#EF4444' }]}>
                    {results.summary.failed}
                  </Text>
                  <Text style={styles.summaryLabel}>Failed</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryNumber, { color: '#F59E0B' }]}>
                    {results.summary.warnings}
                  </Text>
                  <Text style={styles.summaryLabel}>Warnings</Text>
                </View>
              </View>
            </View>

            {/* Critical Issues */}
            {results.criticalIssues.length > 0 && (
              <View style={styles.criticalCard}>
                <View style={styles.criticalHeader}>
                  <MaterialIcons name="error" size={24} color="#EF4444" />
                  <Text style={styles.criticalTitle}>Critical Issues</Text>
                </View>
                {results.criticalIssues.map((issue, index) => (
                  <View key={index} style={styles.criticalItem}>
                    <Text style={styles.criticalName}>{issue.name}</Text>
                    <Text style={styles.criticalMessage}>{issue.message}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Detailed Results */}
            <View style={styles.resultsCard}>
              <Text style={styles.resultsTitle}>Detailed Results</Text>
              {results.allResults.map((result, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.resultItem}
                  onPress={() => toggleExpanded(index)}
                >
                  <View style={styles.resultHeader}>
                    <MaterialIcons
                      name={getStatusIcon(result.status)}
                      size={20}
                      color={getStatusColor(result.status)}
                    />
                    <Text style={styles.resultName}>{result.name}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(result.status) + '20' }]}>
                      <Text style={[styles.statusText, { color: getStatusColor(result.status) }]}>
                        {result.status.toUpperCase()}
                      </Text>
                    </View>
                    <MaterialIcons
                      name={expanded[index] ? 'expand-less' : 'expand-more'}
                      size={20}
                      color="#666666"
                    />
                  </View>
                  <Text style={styles.resultMessage}>{result.message}</Text>
                  
                  {expanded[index] && result.details && (
                    <View style={styles.resultDetails}>
                      {Object.entries(result.details).map(([key, value]) => (
                        <View key={key} style={styles.detailRow}>
                          <Text style={styles.detailKey}>{key}:</Text>
                          <Text style={styles.detailValue}>{String(value)}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Action Buttons */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={runDiagnostics}
              >
                <MaterialIcons name="refresh" size={20} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>Run Again</Text>
              </TouchableOpacity>
              
              <View style={styles.exportButtons}>
                <TouchableOpacity
                  style={[styles.exportButton, styles.exportButtonSecondary]}
                  onPress={copyToClipboard}
                >
                  <MaterialIcons name="content-copy" size={18} color="#0066CC" />
                  <Text style={styles.exportButtonText}>Copy Text</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.exportButton, styles.exportButtonSecondary]}
                  onPress={copyJSONToClipboard}
                >
                  <MaterialIcons name="code" size={18} color="#0066CC" />
                  <Text style={styles.exportButtonText}>Copy JSON</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.exportButton, styles.exportButtonSecondary]}
                  onPress={logToConsole}
                >
                  <MaterialIcons name="bug-report" size={18} color="#0066CC" />
                  <Text style={styles.exportButtonText}>Log to Console</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        {!running && !results && (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="bug-report" size={64} color="#CCCCCC" />
            <Text style={styles.emptyText}>Ready to run diagnostics</Text>
            <TouchableOpacity
              style={styles.runButton}
              onPress={runDiagnostics}
            >
              <Text style={styles.runButtonText}>Start Diagnostics</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    backgroundColor: '#F8F8F8',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    flex: 1,
    textAlign: 'center',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#666666',
  },
  summaryCard: {
    backgroundColor: '#F8F8F8',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryNumber: {
    fontSize: 32,
    fontWeight: '700',
    color: '#10B981',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666666',
  },
  criticalCard: {
    backgroundColor: '#FEF2F2',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  criticalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  criticalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#DC2626',
    marginLeft: 8,
  },
  criticalItem: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#FCA5A5',
  },
  criticalName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#991B1B',
    marginBottom: 4,
  },
  criticalMessage: {
    fontSize: 13,
    color: '#991B1B',
  },
  resultsCard: {
    margin: 16,
    marginTop: 0,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  resultItem: {
    backgroundColor: '#F8F8F8',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  resultName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    flex: 1,
    marginLeft: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  resultMessage: {
    fontSize: 14,
    color: '#666666',
    marginLeft: 28,
  },
  resultDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    marginLeft: 28,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  detailKey: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
    width: 120,
  },
  detailValue: {
    fontSize: 12,
    color: '#1A1A1A',
    flex: 1,
  },
  actions: {
    padding: 16,
    paddingBottom: 32,
  },
  actionButton: {
    backgroundColor: '#0066CC',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  exportButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
    flex: 1,
    minWidth: '30%',
  },
  exportButtonSecondary: {
    backgroundColor: '#E6F2FF',
    borderWidth: 1,
    borderColor: '#0066CC',
  },
  exportButtonText: {
    color: '#0066CC',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666666',
    marginTop: 16,
    marginBottom: 24,
  },
  runButton: {
    backgroundColor: '#0066CC',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
  },
  runButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

