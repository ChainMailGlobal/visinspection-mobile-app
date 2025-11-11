import { MCP_URL, SUPABASE_ANON_KEY } from '../config/env';
import * as FileSystem from 'expo-file-system';

/**
 * AIVisionService - Real-time construction inspection using MCP Backend
 * Uses mode-based AI: Gemini Flash for speed (0.5-1s) during live inspection
 * Falls back to direct OpenAI if MCP unavailable
 */

class AIVisionService {
  constructor() {
    this.mcpUrl = MCP_URL;
    this.supabaseKey = SUPABASE_ANON_KEY;
    this.analyzing = false;
    this.lastAnalysis = null;
    this.sessionId = `mobile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.frameNumber = 0;
  }

  /**
   * Analyze a camera frame for construction inspection
   * @param {string} imageUri - Local URI to the captured frame
   * @param {object} context - Additional context (jurisdiction, project type, etc.)
   * @returns {Promise<object>} Analysis results with materials, compliance, and narration
   */
  async analyzeFrame(imageUri, context = {}) {
    if (this.analyzing) {
      console.log('⏳ Analysis already in progress, skipping...');
      return null;
    }

    try {
      this.analyzing = true;
      this.frameNumber++;

      // Convert image to base64
      const base64Image = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const imageUrl = `data:image/jpeg;base64,${base64Image}`;

      // Call MCP backend (uses Gemini Flash for 3x speed!)
      const response = await fetch(`${this.mcpUrl}/call-tool`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.supabaseKey}`,
        },
        body: JSON.stringify({
          name: 'analyze_live_inspection',
          arguments: {
            imageUrl,
            sessionId: this.sessionId,
            frameNumber: this.frameNumber,
            timestamp: Date.now(),
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('❌ MCP API error:', error);
        throw new Error(`MCP API failed: ${response.status}`);
      }

      const data = await response.json();

      // Parse MCP response
      const mcpContent = data.content?.[0]?.text;
      if (!mcpContent) {
        throw new Error('Invalid MCP response format');
      }

      const analysisData = JSON.parse(mcpContent);

      // Convert MCP format to app format
      const analysis = this.convertMCPToAppFormat(analysisData, context);
      this.lastAnalysis = analysis;

      console.log('✅ AI Vision Analysis (Gemini Flash):', analysis);
      return analysis;
    } catch (error) {
      console.error('❌ Failed to analyze frame:', error);
      return {
        error: error.message,
        narration: 'Unable to analyze image. Please try again.',
        issues: ['Analysis error'],
        category: 'Error',
        materials: [],
        compliance: 'Unable to check compliance',
      };
    } finally {
      this.analyzing = false;
    }
  }

  /**
   * Convert MCP response format to app format
   */
  convertMCPToAppFormat(mcpData, context) {
    const violations = mcpData.violations || [];

    // Extract issues from violations
    const issues = violations.length > 0
      ? violations.map(v => `${v.code}: ${v.issue}`)
      : ['None visible'];

    // Determine category from first violation
    const category = violations.length > 0
      ? this.mapCategoryToTrade(violations[0].category)
      : 'general';

    // Generate narration
    const narration = this.generateNarrationFromViolations(violations, mcpData.summary);

    return {
      category,
      issues,
      materials: [], // MCP doesn't return materials in live mode
      compliance: violations.length > 0 ? 'Code violations detected' : 'No violations found',
      narration,
      rawText: JSON.stringify(mcpData, null, 2),
      timestamp: new Date().toISOString(),
      violations, // Include raw violations for future use
      confidence: mcpData.confidence || 0,
    };
  }

  /**
   * Map MCP category to trade category
   */
  mapCategoryToTrade(category) {
    const mapping = {
      'structural': 'structural',
      'electrical': 'electrical',
      'plumbing': 'plumbing',
      'safety': 'fire safety',
      'quality': 'general',
    };
    return mapping[category] || 'general';
  }

  /**
   * Generate natural narration from violations
   */
  generateNarrationFromViolations(violations, summary) {
    if (violations.length === 0) {
      return 'No visible issues detected. Area appears compliant.';
    }

    const highSeverity = violations.filter(v => v.severity === 'critical' || v.severity === 'high');

    if (highSeverity.length > 0) {
      const firstIssue = highSeverity[0];
      return `${firstIssue.severity.toUpperCase()} issue detected: ${firstIssue.issue}. ${summary || ''}`;
    }

    const firstIssue = violations[0];
    return `Found ${violations.length} issue${violations.length > 1 ? 's' : ''}: ${firstIssue.issue}. ${summary || ''}`;
  }

  /**
   * Generate narration for voice feedback (legacy method for compatibility)
   */
  generateNarration({ materials, compliance, issues, recommendations }) {
    let narration = '';

    // Materials identification
    if (materials && materials.length > 0) {
      const materialList = materials.slice(0, 3).join(', ');
      narration += `I see ${materialList}. `;
    }

    // Code compliance
    if (compliance) {
      narration += `${compliance}. `;
    }

    // Issues
    if (issues && issues.length > 0 && !issues[0].toLowerCase().includes('none')) {
      const issueCount = issues.length;
      narration += `Found ${issueCount} issue${issueCount > 1 ? 's' : ''}: ${issues[0]}. `;
    } else {
      narration += 'No visible issues. ';
    }

    // Recommendations (limit to first one for voice)
    if (recommendations && recommendations.length > 0) {
      narration += `Recommendation: ${recommendations[0]}`;
    }

    return narration.trim();
  }

  /**
   * Analyze building plans for code compliance (FORESIGHT mode)
   * References Honolulu DPP Building Permits requirements
   * @param {string} imageUri - Local URI to the uploaded plan
   * @param {object} context - Additional context (jurisdiction, project type, etc.)
   * @returns {Promise<object>} Analysis results with compliance and permit info
   */
  async analyzePlan(imageUri, context = {}) {
    try {
      console.log('📋 Analyzing building plan against Honolulu DPP requirements...');

      // Convert image to base64
      const base64Image = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const imageUrl = `data:image/jpeg;base64,${base64Image}`;

      // Call MCP backend with analyze_photo tool
      const response = await fetch(`${this.mcpUrl}/call-tool`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.supabaseKey}`,
        },
        body: JSON.stringify({
          name: 'analyze_photo',
          arguments: {
            imageUrl,
            analysisType: 'code_compliance',
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('❌ MCP API error:', error);
        throw new Error(`MCP API failed: ${response.status}`);
      }

      const data = await response.json();

      // Parse MCP response
      const mcpContent = data.content?.[0]?.text;
      if (!mcpContent) {
        throw new Error('Invalid MCP response format');
      }

      const analysisData = JSON.parse(mcpContent);

      // Convert to plan analysis format with Honolulu DPP reference
      const planAnalysis = {
        category: analysisData.category || 'Residential Construction',
        compliance: analysisData.compliance || 'Code compliance check complete',
        issues: analysisData.violations?.map(v => v.issue) || [],
        violations: analysisData.violations || [],
        summary: analysisData.summary || 'Plan analyzed',
        recommendations: analysisData.recommendations || [],
        permitInfo: {
          authority: 'Honolulu Department of Planning and Permitting (DPP)',
          referenceUrl: 'https://www.honolulu.gov/dpp/permitting/building-permits-home/building-permits-inspection/',
          message: 'Verify requirements with DPP before submission',
        },
        timestamp: new Date().toISOString(),
      };

      console.log('✅ Plan Analysis Complete (Honolulu DPP):', planAnalysis);
      return planAnalysis;
    } catch (error) {
      console.error('❌ Failed to analyze plan:', error);
      throw error;
    }
  }

  /**
   * Identify construction materials from photo
   * @param {string} imageUri - Local URI to the material photo
   * @returns {Promise<object>} Material identification results
   */
  async identifyMaterial(imageUri) {
    try {
      console.log('🔍 Identifying construction material...');

      // Convert image to base64
      const base64Image = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const imageUrl = `data:image/jpeg;base64,${base64Image}`;

      // Call MCP backend with analyze_photo tool
      const response = await fetch(`${this.mcpUrl}/call-tool`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.supabaseKey}`,
        },
        body: JSON.stringify({
          name: 'analyze_photo',
          arguments: {
            imageUrl,
            analysisType: 'material_identification',
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('❌ MCP API error:', error);
        throw new Error(`MCP API failed: ${response.status}`);
      }

      const data = await response.json();

      // Parse MCP response
      const mcpContent = data.content?.[0]?.text;
      if (!mcpContent) {
        throw new Error('Invalid MCP response format');
      }

      const analysisData = JSON.parse(mcpContent);

      // Convert to material identification format
      const materialResult = {
        materials: analysisData.materials || [],
        compliance: analysisData.compliance || 'Material identified',
        category: 'Material Identification',
        specifications: analysisData.specifications || [],
        recommendations: analysisData.recommendations || [],
        timestamp: new Date().toISOString(),
      };

      console.log('✅ Material Identified:', materialResult);
      return materialResult;
    } catch (error) {
      console.error('❌ Failed to identify material:', error);
      throw error;
    }
  }

  /**
   * Get the last analysis result
   */
  getLastAnalysis() {
    return this.lastAnalysis;
  }

  /**
   * Check if currently analyzing
   */
  isAnalyzing() {
    return this.analyzing;
  }

  /**
   * Clear analysis history
   */
  clearHistory() {
    this.lastAnalysis = null;
    this.frameNumber = 0;
    this.sessionId = `mobile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Reset session (start new inspection)
   */
  resetSession() {
    this.sessionId = `mobile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.frameNumber = 0;
    this.lastAnalysis = null;
  }
}

export default new AIVisionService();
