import { MCP_URL, SUPABASE_ANON_KEY, OPENAI_API_KEY } from '../config/env';
import * as FileSystem from 'expo-file-system';

/**
 * AIVisionService - Real-time construction inspection using MCP Backend
 * Uses mode-based AI: Gemini Flash for speed (0.5-1s) during live inspection
 * Falls back to direct OpenAI if MCP unavailable
 * FIXED: Proper race condition handling and OpenAI fallback
 */

class AIVisionService {
  constructor() {
    this.mcpUrl = MCP_URL;
    this.supabaseKey = SUPABASE_ANON_KEY;
    this.openaiKey = OPENAI_API_KEY;

    // Race condition fix: use promise-based locking
    this.currentAnalysis = null;

    this.lastAnalysis = null;
    this.sessionId = `mobile_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    this.frameNumber = 0;

    // Retry configuration
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 5000
    };
  }

  /**
   * Analyze a camera frame for construction inspection
   * @param {string} imageUri - Local URI to the captured frame
   * @param {object} context - Additional context (jurisdiction, project type, etc.)
   * @returns {Promise<object>} Analysis results with materials, compliance, and narration
   */
  async analyzeFrame(imageUri, context = {}) {
    // ===================================================================
    // FIX: Proper race condition handling using promise-based locking
    // ===================================================================
    if (this.currentAnalysis) {
      console.log('⏳ Analysis already in progress, returning existing promise...');
      return this.currentAnalysis;
    }

    // Create analysis promise
    this.currentAnalysis = this._performAnalysis(imageUri, context)
      .finally(() => {
        this.currentAnalysis = null;
      });

    return this.currentAnalysis;
  }

  /**
   * Internal method to perform analysis with retry logic
   */
  async _performAnalysis(imageUri, context) {
    let imageUrl;

    try {
      this.frameNumber++;

      // Convert image to base64
      const base64Image = await FileSystem.readAsString(imageUri, {
        encoding: 'base64',
      });

      imageUrl = `data:image/jpeg;base64,${base64Image}`;

      // Try MCP backend first with retry logic
      return await this._retryWithBackoff(
        () => this._analyzeWithMCP(imageUrl, context),
        'MCP'
      );
    } catch (mcpError) {
      console.error('❌ MCP analysis failed after retries:', mcpError);

      // ===================================================================
      // FIX: Fallback to OpenAI when MCP fails
      // ===================================================================
      if (imageUrl) {
        try {
          console.log('🔄 Falling back to OpenAI direct API...');
          return await this._analyzeWithOpenAI(imageUrl, context);
        } catch (openaiError) {
          console.error('❌ OpenAI fallback failed:', openaiError);
        }
      }

      // Return graceful error response
      return {
        error: 'Analysis service unavailable',
        narration: 'Unable to analyze image. Please check your connection and try again.',
        issues: ['Analysis error'],
        category: 'Error',
        materials: [],
        compliance: 'Unable to check compliance',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Retry with exponential backoff
   */
  async _retryWithBackoff(fn, serviceName) {
    let lastError;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        if (attempt < this.retryConfig.maxRetries) {
          const delay = Math.min(
            this.retryConfig.baseDelay * Math.pow(2, attempt),
            this.retryConfig.maxDelay
          );
          console.log(`⚠️ ${serviceName} attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  /**
   * Analyze with MCP backend
   */
  async _analyzeWithMCP(imageUrl, context) {
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
      // Timeout after 30 seconds
      signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ MCP API error:', error);
      throw new Error(`MCP API failed: ${response.status} - ${error}`);
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

    console.log('✅ AI Vision Analysis (Gemini Flash via MCP):', analysis);
    return analysis;
  }

  /**
   * Analyze with OpenAI direct (fallback)
   */
  async _analyzeWithOpenAI(imageUrl, context) {
    if (!this.openaiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const prompt = `You are analyzing a construction site in REAL-TIME. Be FAST and CONCISE.

ANALYZE THIS IMAGE FOR:
1. Building code violations (cite Honolulu codes: IRC 2018, IBC 2018, NEC 2020, IPC 2018)
2. Safety hazards (OSHA violations)
3. Structural defects
4. Quality issues

Return ONLY JSON in this exact format:
{
  "violations": [{
    "id": "unique_id",
    "code": "HBC 1808.3",
    "issue": "Brief description",
    "severity": "critical|high|medium|low",
    "category": "structural|electrical|plumbing|safety|quality"
  }],
  "summary": "Quick summary",
  "confidence": 0-100
}

If NO violations: return {"violations": [], "summary": "No violations detected", "confidence": 95}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt
            },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl
              }
            }
          ]
        }],
        max_tokens: 800,
        temperature: 0.3
      }),
      // Timeout after 30 seconds
      signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API failed: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const analysisText = data.choices?.[0]?.message?.content || '{"violations": []}';

    let analysisData;
    try {
      analysisData = JSON.parse(analysisText);
    } catch {
      analysisData = {
        violations: [],
        summary: 'Analysis parsing error',
        confidence: 0
      };
    }

    // Convert to app format
    const analysis = this.convertMCPToAppFormat(analysisData, context);
    this.lastAnalysis = analysis;

    console.log('✅ AI Vision Analysis (OpenAI Fallback):', analysis);
    return analysis;
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
      const base64Image = await FileSystem.readAsString(imageUri, {
        encoding: 'base64',
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

      // Convert to plan analysis format
      // Note: For real DPP pre-check with code citations, use DppPrecheckService instead
      const planAnalysis = {
        category: analysisData.category || 'Residential Construction',
        compliance: analysisData.compliance || 'Code compliance check complete',
        issues: analysisData.violations?.map(v => v.issue) || [],
        violations: analysisData.violations || [],
        summary: analysisData.summary || 'Plan analyzed',
        recommendations: analysisData.recommendations || [],
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
      const base64Image = await FileSystem.readAsString(imageUri, {
        encoding: 'base64',
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
    return !!this.currentAnalysis;
  }

  /**
   * Clear analysis history
   */
  clearHistory() {
    this.lastAnalysis = null;
    this.frameNumber = 0;
    this.sessionId = `mobile_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Reset session (start new inspection)
   */
  resetSession() {
    this.sessionId = `mobile_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    this.frameNumber = 0;
    this.lastAnalysis = null;
  }
}

export default new AIVisionService();
