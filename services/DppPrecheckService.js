import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/env';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Run Honolulu DPP Pre-Check with actual code citations and page numbers
 * @param {object} params - { jurisdiction, projectType, pkg }
 * @returns {Promise<object>} - { status, violations, notes, code_citations }
 */
export async function runDppPrecheck({ jurisdiction = 'honolulu', projectType = 'residential', imageUrl }) {
  try {
    console.log('📋 Running DPP Pre-Check...', { jurisdiction, projectType });

    const { data, error } = await supabase.functions.invoke('dpp-precheck', {
      body: {
        imageUrl,
        projectType,
      },
    });

    if (error) {
      console.error('❌ DPP Pre-Check Error:', error);
      throw error;
    }

    console.log('✅ DPP Pre-Check Complete:', data);
    return data;
  } catch (error) {
    console.error('❌ DPP Pre-Check failed:', error);
    throw error;
  }
}
