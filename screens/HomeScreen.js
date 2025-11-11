import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Text,
} from 'react-native';

export default function HomeScreen({ navigation }) {
  const startLiveInspection = () => {
    navigation.navigate('LiveInspection', {
      projectId: null, // Will auto-create from GPS
      inspectionType: 'building',
      projectName: 'New Inspection'
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Build Right As You Go</Text>
          <Text style={styles.headerSubtitle}>
            AI-powered visual inspection platform
          </Text>
        </View>

        {/* Three-Phase Workflow */}
        <View style={styles.phasesContainer}>
          <TouchableOpacity
            style={styles.phaseCard}
            onPress={() => navigation.navigate('BuildingCodes')}
            activeOpacity={0.8}
          >
            <View style={styles.phaseHeader}>
              <View style={[styles.phaseBadge, { backgroundColor: '#0066CC' }]}>
                <Text style={styles.phaseBadgeText}>1</Text>
              </View>
              <Text style={styles.phaseTitle}>Foresight</Text>
            </View>
            <Text style={styles.phaseDescription}>
              Pre-submission plan validation against building codes
            </Text>
            <Text style={styles.phaseAction}>Pre-Check Plans →</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.phaseCard, styles.phaseCardHighlight]}
            onPress={startLiveInspection}
            activeOpacity={0.8}
          >
            <View style={styles.phaseHeader}>
              <View style={[styles.phaseBadge, { backgroundColor: '#00CC66' }]}>
                <Text style={styles.phaseBadgeText}>2</Text>
              </View>
              <Text style={styles.phaseTitle}>Eyesight</Text>
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>ACTIVE</Text>
              </View>
            </View>
            <Text style={styles.phaseDescription}>
              Live AI inspection with code violation detection and GPS tracking
            </Text>
            <Text style={styles.phaseAction}>Start Live AI Mode →</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.phaseCard, styles.phaseCardDisabled]}
            activeOpacity={0.8}
          >
            <View style={styles.phaseHeader}>
              <View style={[styles.phaseBadge, { backgroundColor: '#CCCCCC' }]}>
                <Text style={styles.phaseBadgeText}>3</Text>
              </View>
              <Text style={[styles.phaseTitle, { color: '#999999' }]}>Hindsight</Text>
              <View style={styles.comingSoonBadge}>
                <Text style={styles.comingSoonText}>COMING SOON</Text>
              </View>
            </View>
            <Text style={[styles.phaseDescription, { color: '#999999' }]}>
              Post-construction compliance documentation
            </Text>
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActionsContainer}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Projects')}
          >
            <Text style={styles.actionButtonText}>My Projects</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('MaterialIdentification')}
          >
            <Text style={styles.actionButtonText}>Identify Material</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Report')}
          >
            <Text style={styles.actionButtonText}>Generate Report</Text>
          </TouchableOpacity>
        </View>

        {/* Value Prop */}
        <View style={styles.valueContainer}>
          <Text style={styles.valueText}>
            One prevented rework pays for the platform
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 24,
    backgroundColor: '#F8F8F8',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666666',
  },
  phasesContainer: {
    padding: 16,
  },
  phaseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  phaseCardHighlight: {
    borderColor: '#00CC66',
    borderWidth: 2,
    backgroundColor: '#F0FFF8',
  },
  phaseCardDisabled: {
    opacity: 0.6,
  },
  phaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  phaseBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  phaseBadgeText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  phaseTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
    flex: 1,
  },
  activeBadge: {
    backgroundColor: '#00CC66',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  comingSoonBadge: {
    backgroundColor: '#F8F8F8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  comingSoonText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#999999',
    letterSpacing: 0.5,
  },
  phaseDescription: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
    marginBottom: 12,
  },
  phaseAction: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0066CC',
  },
  quickActionsContainer: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  actionButton: {
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  valueContainer: {
    margin: 16,
    backgroundColor: '#F0F7FF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#0066CC',
  },
  valueText: {
    fontSize: 13,
    color: '#0066CC',
    textAlign: 'center',
    fontWeight: '500',
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#0066CC',
  },
});
