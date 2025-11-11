/**
 * VoiceService - Text-to-Speech Only (TTS)
 * Voice recognition removed - use button controls
 */

import * as Speech from 'expo-speech';

class VoiceService {
  constructor() {
    this.isSpeaking = false;
  }

  /**
   * Speak text aloud (TTS)
   */
  async speak(text, options = {}) {
    try {
      this.isSpeaking = true;
      await Speech.speak(text, {
        language: 'en-US',
        pitch: 1.0,
        rate: 0.9,
        ...options,
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
      console.error('Stop speech error:', error);
    }
  }

  /**
   * Check if currently speaking
   */
  getIsSpeaking() {
    return this.isSpeaking;
  }
}

export default new VoiceService();
