import * as Speech from 'expo-speech';

/**
 * VoiceService - Text-to-speech for narration (TTS only, no recognition)
 * Simplified for Expo managed workflow compatibility
 */

class VoiceService {
  constructor() {
    this.isSpeaking = false;
  }

  /**
   * Speak text aloud (TTS only)
   */
  async speak(text) {
    try {
      this.isSpeaking = true;
      await Speech.speak(text, {
        language: 'en-US',
        pitch: 1.0,
        rate: 0.9,
      });
      this.isSpeaking = false;
    } catch (error) {
      console.error('Speech error:', error);
      this.isSpeaking = false;
    }
  }

  /**
   * Stop speaking
   */
  async stop() {
    try {
      await Speech.stop();
      this.isSpeaking = false;
    } catch (error) {
      console.error('Speech stop error:', error);
    }
  }

  /**
   * No-op methods for backward compatibility with Classic Mode
   * (These screens expected voice recognition but we removed it)
   */
  async startListening(callback) {
    console.log('Voice recognition disabled - TTS only mode');
    return true;
  }

  async stopListening() {
    console.log('Voice recognition disabled - TTS only mode');
  }

  removeAllListeners() {
    // No-op
  }

  /**
   * Check if currently speaking
   */
  getSpeakingStatus() {
    return this.isSpeaking;
  }
}

export default new VoiceService();
