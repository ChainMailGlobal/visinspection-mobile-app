import { OPENAI_API_KEY } from '../config/env';
import * as FileSystem from 'expo-file-system';

/**
 * AIVisionService - Real-time construction inspection using OpenAI GPT-4 Vision
 * Analyzes camera frames for building code compliance, materials, and defects
 */

class AIVisionService {
  constructor() {
    this.apiKey = OPENAI_API_KEY;
    this.analyzing = false;
    this.lastAnalysis = null;
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

      // Convert image to base64
      const base64Image = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Build construction-focused prompt
      const prompt = this.buildInspectionPrompt(context);

      // Call OpenAI GPT-4 Vision API
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4-vision-preview',
          messages: [
            {
              role: 'system',
              content: 'You are a professional construction inspector with expertise in IBC (International Building Code) and IRC (International Residential Code). Analyze images for code compliance, material identification, and defects.',
            },
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${base64Image}`,
                  },
                },
              ],
            },
          ],
          max_tokens: 500,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('❌ OpenAI API error:', error);
        throw new Error(error.error?.message || 'Vision API failed');
      }

      const data = await response.json();
      const analysisText = data.choices[0].message.content;

      // Parse the analysis into structured data
      const analysis = this.parseAnalysis(analysisText, context);
      this.lastAnalysis = analysis;

      console.log('✅ AI Vision Analysis:', analysis);
      return analysis;
    } catch (error) {
      console.error('❌ Failed to analyze frame:', error);
      return {
        error: error.message,
        narration: 'Unable to analyze image. Please try again.',
      };
    } finally {
      this.analyzing = false;
    }
  }

  /**
   * Build inspection prompt based on context
   */
  buildInspectionPrompt(context) {
    const { projectType = 'residential', jurisdiction = 'IBC 2021' } = context;

    return `Analyze this construction site image as a professional inspector.

**Inspection Context:**
- Project Type: ${projectType}
- Code Jurisdiction: ${jurisdiction}

**Please identify:**
1. **Materials Visible**: What construction materials do you see? (wood framing, concrete, drywall, etc.)
2. **Code Compliance**: Check spacing, dimensions, and installation against ${jurisdiction}
3. **Defects or Issues**: Any visible problems, safety hazards, or code violations?
4. **Recommendations**: What should be checked, measured, or corrected?

**Format your response as:**
Materials: [list materials]
Compliance: [code check results]
Issues: [defects found, or "None visible"]
Recommendations: [action items]

Keep it concise and jobsite-appropriate. Focus on what a contractor needs to know.`;
  }

  /**
   * Parse GPT-4 response into structured data
   */
  parseAnalysis(analysisText, context) {
    const lines = analysisText.split('\n');

    let category = '';
    let materials = [];
    let compliance = '';
    let issues = [];

    let currentSection = null;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.toLowerCase().startsWith('category:')) {
        category = trimmed.replace(/^category:/i, '').trim();
      } else if (trimmed.toLowerCase().startsWith('materials:')) {
        currentSection = 'materials';
        const content = trimmed.replace(/^materials:/i, '').trim();
        if (content) materials.push(content);
      } else if (trimmed.toLowerCase().startsWith('compliance:')) {
        currentSection = 'compliance';
        compliance = trimmed.replace(/^compliance:/i, '').trim();
      } else if (trimmed.toLowerCase().startsWith('issues:')) {
        currentSection = 'issues';
        const content = trimmed.replace(/^issues:/i, '').trim();
        if (content && !content.toLowerCase().includes('none')) {
          issues.push(content);
        }
      } else if (trimmed && currentSection) {
        // Continue adding to current section
        if (currentSection === 'materials') materials.push(trimmed);
        else if (currentSection === 'compliance') compliance += ' ' + trimmed;
        else if (currentSection === 'issues' && !trimmed.toLowerCase().includes('none')) {
          issues.push(trimmed);
        }
      }
    }

    // Generate narration for voice feedback
    const narration = this.generateNarration({
      category,
      materials,
      compliance,
      issues,
    });

    return {
      category: category || 'General',
      materials,
      compliance: compliance || 'Checking compliance',
      issues: issues.length > 0 ? issues : ['None visible'],
      narration,
      rawText: analysisText,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Generate natural narration for voice feedback
   */
  generateNarration({ materials, compliance, issues, recommendations }) {
    let narration = '';

    // Materials identification
    if (materials.length > 0) {
      const materialList = materials.slice(0, 3).join(', ');
      narration += `I see ${materialList}. `;
    }

    // Code compliance
    if (compliance) {
      narration += `${compliance}. `;
    }

    // Issues
    if (issues.length > 0 && !issues[0].toLowerCase().includes('none')) {
      const issueCount = issues.length;
      narration += `Found ${issueCount} issue${issueCount > 1 ? 's' : ''}: ${issues[0]}. `;
    } else {
      narration += 'No visible issues. ';
    }

    // Recommendations (limit to first one for voice)
    if (recommendations.length > 0) {
      narration += `Recommendation: ${recommendations[0]}`;
    }

    return narration.trim();
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
  }
}

export default new AIVisionService();
