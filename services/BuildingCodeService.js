import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * BuildingCodeService - Fetch and cache building codes for real-time inspection
 */

const HONOLULU_CODES = {
  building: 'https://codelibrary.amlegal.com/codes/honolulu/latest/honolulu/0-0-0-17062',
  residential: 'https://codelibrary.amlegal.com/codes/honolulu/latest/honolulu/0-0-0-17031',
};

const CACHE_KEY = 'building_codes_cache';
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

class BuildingCodeService {
  constructor() {
    this.codeCache = {};
  }

  /**
   * Fetch Honolulu building codes
   */
  async fetchHonoluluCodes() {
    try {
      // Check cache first
      const cached = await this.getCachedCodes();
      if (cached) {
        console.log('✅ Using cached Honolulu building codes');
        this.codeCache = cached;
        return cached;
      }

      console.log('📥 Fetching Honolulu building codes...');

      // Fetch both code pages
      const [buildingResponse, residentialResponse] = await Promise.all([
        fetch(HONOLULU_CODES.building),
        fetch(HONOLULU_CODES.residential),
      ]);

      const [buildingHtml, residentialHtml] = await Promise.all([
        buildingResponse.text(),
        residentialResponse.text(),
      ]);

      // Parse relevant sections from HTML
      const codes = {
        building: this.parseCodeContent(buildingHtml, 'Building Code'),
        residential: this.parseCodeContent(residentialHtml, 'Residential Code'),
        timestamp: Date.now(),
      };

      // Cache for future use
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(codes));
      this.codeCache = codes;

      console.log('✅ Honolulu codes fetched and cached');
      return codes;
    } catch (error) {
      console.error('❌ Failed to fetch Honolulu codes:', error);
      return null;
    }
  }

  /**
   * Parse HTML content to extract code text
   */
  parseCodeContent(html, codeType) {
    // Strip HTML tags and extract text content
    const textContent = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Extract key sections
    return {
      type: codeType,
      content: textContent.substring(0, 3000), // Limit to 3000 chars for context
      fullText: textContent,
    };
  }

  /**
   * Get cached codes if still valid
   */
  async getCachedCodes() {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (!cached) return null;

      const codes = JSON.parse(cached);
      const age = Date.now() - codes.timestamp;

      if (age < CACHE_DURATION) {
        return codes;
      }

      return null;
    } catch (error) {
      console.error('Error reading code cache:', error);
      return null;
    }
  }

  /**
   * Get code context for AI analysis
   */
  async getCodeContext(category, projectType = 'residential') {
    if (!this.codeCache.building) {
      await this.fetchHonoluluCodes();
    }

    const codeType = projectType === 'residential' ? 'residential' : 'building';
    const codes = this.codeCache[codeType];

    if (!codes) return '';

    // Return relevant code excerpt
    const excerpt = codes.content.substring(0, 500);
    return `
**Honolulu ${codes.type} Requirements:**
${excerpt}...

When checking compliance, reference Honolulu Building Code standards.
`;
  }

  /**
   * Get permit requirements based on work type
   */
  getPermitRequirements(category) {
    const permits = {
      electrical: {
        permit: 'Electrical Permit Required',
        notes: 'All electrical work requires permit per Honolulu Building Code',
        inspector: 'City & County of Honolulu Electrical Inspector',
      },
      plumbing: {
        permit: 'Plumbing Permit Required',
        notes: 'All plumbing alterations require permit per Honolulu Building Code',
        inspector: 'City & County of Honolulu Plumbing Inspector',
      },
      structural: {
        permit: 'Building Permit Required',
        notes: 'Structural work requires building permit and engineer approval',
        inspector: 'City & County of Honolulu Building Inspector',
      },
      'fire safety': {
        permit: 'Fire Safety Permit Required',
        notes: 'Fire protection systems require Fire Department approval',
        inspector: 'Honolulu Fire Department',
      },
      HVAC: {
        permit: 'Mechanical Permit Required',
        notes: 'HVAC installation requires mechanical permit',
        inspector: 'City & County of Honolulu Mechanical Inspector',
      },
    };

    return permits[category] || {
      permit: 'Check Permit Requirements',
      notes: 'Verify if permit required for this work type',
      inspector: 'City & County of Honolulu',
    };
  }
}

export default new BuildingCodeService();
