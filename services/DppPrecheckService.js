import getSupabaseClient from './supabaseClient';

/**
 * Run Honolulu DPP Pre-Check with actual code citations and page numbers
 * @param {object} params - { jurisdiction, projectType, pkg }
 * @returns {Promise<object>} - { status, violations, notes, code_citations }
 */
export async function runDppPrecheck({ jurisdiction = 'honolulu', projectType = 'residential', imageUrl }) {
  try {
    console.log('📋 Running DPP Pre-Check...', { jurisdiction, projectType });

    const supabase = getSupabaseClient();

    // Check if supabase.functions exists
    if (!supabase.functions || typeof supabase.functions.invoke !== 'function') {
      throw new Error('Supabase Edge Functions not available. Please check your Supabase client configuration.');
    }

    const { data, error } = await supabase.functions.invoke('dpp-precheck', {
      body: {
        imageUrl,
        projectType,
      },
    });

    if (error) {
      console.error('❌ DPP Pre-Check Error:', error);
      // Provide more helpful error message
      if (error.message?.includes('Function not found')) {
        throw new Error('DPP Pre-Check service is not deployed. Please contact support.');
      }
      throw new Error(error.message || 'DPP Pre-Check failed');
    }

    console.log('✅ DPP Pre-Check Complete:', data);
    return data;
  } catch (error) {
    console.error('❌ DPP Pre-Check failed:', error);

    // Provide user-friendly error messages
    if (error.message?.includes('not a function')) {
      throw new Error('Service configuration error. Please update the app.');
    }

    throw error;
  }
}
