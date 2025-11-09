import {
  ExpoSpeechRecognitionModule,
  addSpeechRecognitionListener,
} from 'expo-speech-recognition';
import * as Speech from 'expo-speech';

/**
 * VoiceService - Voice recognition and text-to-speech for hands-free jobsite operation
 * Using expo-speech-recognition for AndroidX compatibility
 */

class VoiceService {
  constructor() {
    this.isListening = false;
    this.onResultCallback = null;
    this.onErrorCallback = null;
    this.subscription = null;

    // Voice command patterns for construction inspections
    this.commands = {
      // Inspection actions
      take_photo: ['take photo', 'capture photo', 'take picture', 'photo'],
      mark_defect: ['mark defect', 'flag issue', 'note problem', 'defect'],

      // Navigation
      start_inspection: ['start inspection', 'new inspection', 'begin inspection'],
      save_inspection: ['save inspection', 'save project', 'finish'],

      // Building codes
      building_codes: ['building codes', 'show codes', 'get codes', 'code requirements'],
      check_compliance: ['check compliance', 'code check', 'verify code'],

      // Materials
      identify_material: ['identify material', 'what is this', 'material info'],

      // Reports
      generate_report: ['generate report', 'create report', 'make report'],

      // General
      go_home: ['go home', 'home', 'main menu'],
      help: ['help', 'what can you do', 'commands'],
    };
  }

  /**
   * Match transcription to command
   */
  matchCommand(transcription) {
    for (const [commandName, patterns] of Object.entries(this.commands)) {
      for (const pattern of patterns) {
        if (transcription.includes(pattern)) {
          return commandName;
        }
      }
    }
    return null;
  }

  /**
   * Start listening for voice commands
   */
  async startListening(onResult, onError) {
    try {
      this.onResultCallback = onResult;
      this.onErrorCallback = onError;

      // Request permissions
      const { status } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (status !== 'granted') {
        const errorMsg = 'Microphone permission not granted';
        console.warn('⚠️', errorMsg);
        if (onError) onError(errorMsg);
        return false;
      }

      // Set up listener
      this.subscription = addSpeechRecognitionListener((event) => {
        if (event.type === 'start') {
          console.log('🎤 Voice recognition started');
          this.isListening = true;
        } else if (event.type === 'end') {
          console.log('🎤 Voice recognition ended');
          this.isListening = false;
        } else if (event.type === 'result') {
          const results = event.results;
          if (results && results.length > 0) {
            const transcription = results[0].transcript.toLowerCase();
            console.log('🎤 Transcription:', transcription);

            const command = this.matchCommand(transcription);

            if (this.onResultCallback) {
              this.onResultCallback({
                transcription,
                command,
                confidence: results[0].confidence || 1,
              });
            }
          }
        } else if (event.type === 'error') {
          console.error('❌ Voice recognition error:', event.error);
          this.isListening = false;
          if (this.onErrorCallback) {
            this.onErrorCallback(event.error);
          }
        }
      });

      // Start recognition
      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        maxAlternatives: 1,
        continuous: false,
        requiresOnDeviceRecognition: false,
      });

      return true;
    } catch (error) {
      console.error('❌ Failed to start voice recognition:', error);
      if (onError) onError(error.message);
      return false;
    }
  }

  /**
   * Stop listening
   */
  async stopListening() {
    try {
      ExpoSpeechRecognitionModule.stop();
      this.isListening = false;

      if (this.subscription) {
        this.subscription.remove();
        this.subscription = null;
      }

      return true;
    } catch (error) {
      console.error('❌ Failed to stop voice recognition:', error);
      return false;
    }
  }

  /**
   * Cancel voice recognition
   */
  async cancel() {
    try {
      ExpoSpeechRecognitionModule.abort();
      this.isListening = false;

      if (this.subscription) {
        this.subscription.remove();
        this.subscription = null;
      }
    } catch (error) {
      console.error('❌ Failed to cancel voice recognition:', error);
    }
  }

  /**
   * Destroy voice recognition
   */
  async destroy() {
    await this.stopListening();
    this.onResultCallback = null;
    this.onErrorCallback = null;
  }

  /**
   * Speak text (audio feedback) - Works in both Expo Go and Dev Build
   */
  async speak(text, options = {}) {
    try {
      await Speech.speak(text, {
        language: 'en-US',
        pitch: 1.0,
        rate: 0.9,
        ...options,
      });
      return true;
    } catch (error) {
      console.error('❌ Failed to speak:', error);
      return false;
    }
  }

  /**
   * Stop speaking
   */
  async stopSpeaking() {
    try {
      await Speech.stop();
    } catch (error) {
      console.error('❌ Failed to stop speaking:', error);
    }
  }

  /**
   * Check if voice recognition is available
   */
  async isAvailable() {
    try {
      const result = await ExpoSpeechRecognitionModule.getStateAsync();
      return result.isAvailable;
    } catch (error) {
      return false;
    }
  }
}

export default new VoiceService();
