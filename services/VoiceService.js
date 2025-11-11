/**
 * VoiceService - Full Voice Recognition for VIS Eyesight Mobile
 * Emulates Spectacles Lens wake-word workflow with STT + TTS
 * Uses expo-speech-recognition (requires dev build)
 */

import * as Speech from 'expo-speech';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
  addSpeechRecognitionListener,
} from 'expo-speech-recognition';

// Voice recognition states (matches Spectacles)
const State = {
  IDLE: 'idle',           // Waiting for wake word "Aloha"
  LISTENING: 'listening', // Wake word detected, listening for commands
  PROCESSING: 'processing' // Processing a command
};

class VoiceService {
  constructor() {
    this.currentState = State.IDLE;
    this.isSpeaking = false;
    this.isListening = false;
    this.lastTranscript = '';
    this.lastCommandTime = 0;
    this.listeners = [];
    this.stateChangeListeners = [];
    this.COMMAND_COOLDOWN = 1000; // 1 second
    this.LISTENING_TIMEOUT = 10000; // 10 seconds
    this.timeoutHandle = null;
    this.currentMode = 'READY';
  }

  /**
   * Initialize voice recognition
   */
  async initialize() {
    try {
      console.log('🎤 Initializing Voice Recognition...');

      // Request permissions
      const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!granted) {
        console.error('❌ Voice recognition permission denied');
        return false;
      }

      // Get supported locales
      const { locales } = await ExpoSpeechRecognitionModule.getSupportedLocales();
      console.log('✅ Voice recognition ready. Locales:', locales.slice(0, 3));

      // Set up recognition listener
      this.setupRecognitionListener();

      // Auto-start listening for wake word
      await this.startWakeWordDetection();

      return true;
    } catch (error) {
      console.error('❌ Voice recognition initialization failed:', error);
      return false;
    }
  }

  /**
   * Set up speech recognition event listener
   */
  setupRecognitionListener() {
    const subscription = addSpeechRecognitionListener((event) => {
      if (event.type === 'result') {
        const transcript = event.results?.[0]?.transcript?.toLowerCase().trim();
        if (transcript && transcript !== this.lastTranscript) {
          this.lastTranscript = transcript;
          this.processVoiceInput(transcript);
        }
      } else if (event.type === 'error') {
        console.error('🎤 Recognition error:', event.error);
        // Restart wake word detection on error
        setTimeout(() => this.startWakeWordDetection(), 1000);
      } else if (event.type === 'end') {
        console.log('🎤 Recognition ended');
        if (this.currentState === State.IDLE) {
          // Restart wake word detection
          setTimeout(() => this.startWakeWordDetection(), 500);
        }
      }
    });

    this.listeners.push(subscription);
  }

  /**
   * Start continuous wake word detection
   */
  async startWakeWordDetection() {
    if (this.isListening) return;

    try {
      this.currentState = State.IDLE;
      this.notifyStateChange('IDLE', 'Say "Aloha" to start');

      await ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: false,
        continuous: true,
        maxAlternatives: 1,
      });

      this.isListening = true;
      console.log('🎤 Listening for wake word "Aloha"...');
    } catch (error) {
      console.error('❌ Failed to start wake word detection:', error);
    }
  }

  /**
   * Process voice input based on current state
   */
  processVoiceInput(transcript) {
    const now = Date.now();
    console.log(`🎤 [${this.currentState}] Heard: "${transcript}"`);

    // Check for wake word at any time
    if (this.containsWakeWord(transcript)) {
      this.onWakeWordDetected();
      return;
    }

    // Process commands only when listening
    if (this.currentState === State.LISTENING) {
      // Check cooldown
      if (now - this.lastCommandTime < this.COMMAND_COOLDOWN) {
        console.log('⏱️ Command cooldown active');
        return;
      }

      // Process commands
      this.processCommand(transcript);
      this.resetListeningTimeout();
    }
  }

  /**
   * Process recognized command
   */
  processCommand(transcript) {
    console.log('🎯 Processing command:', transcript);

    // Capture commands
    if (this.containsCommand(transcript, ['capture']) ||
        this.containsCommand(transcript, ['mark']) ||
        this.containsCommand(transcript, ['document'])) {
      this.notifyCommand('capture');
      this.speak('Capturing violation');
      this.lastCommandTime = Date.now();
    }
    // Start/Stop inspection
    else if (this.containsCommand(transcript, ['start', 'inspection']) ||
             this.containsCommand(transcript, ['begin', 'scan'])) {
      this.notifyCommand('start_inspection');
      this.speak('Starting inspection');
      this.currentMode = 'INSPECTING';
      this.lastCommandTime = Date.now();
    }
    else if (this.containsCommand(transcript, ['stop', 'inspection']) ||
             this.containsCommand(transcript, ['end', 'scan']) ||
             this.containsCommand(transcript, ['pause'])) {
      this.notifyCommand('stop_inspection');
      this.speak('Stopping inspection');
      this.currentMode = 'READY';
      this.lastCommandTime = Date.now();
    }
    // Navigation
    else if (this.containsCommand(transcript, ['help'])) {
      this.speak('Say capture violation, start inspection, or stop inspection');
      this.lastCommandTime = Date.now();
    }
    else if (this.containsCommand(transcript, ['cancel']) ||
             this.containsCommand(transcript, ['nevermind'])) {
      this.resetToIdle();
    }
  }

  /**
   * Handle wake word detection
   */
  async onWakeWordDetected() {
    console.log('✅ Wake word "Aloha" detected!');

    this.currentState = State.LISTENING;
    this.notifyStateChange('LISTENING', 'Listening for commands...');

    await this.speak('Ready');

    // Set listening timeout
    this.resetListeningTimeout();
  }

  /**
   * Reset listening timeout
   */
  resetListeningTimeout() {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
    }

    this.timeoutHandle = setTimeout(() => {
      console.log('⏰ Listening timeout - returning to idle');
      this.resetToIdle();
    }, this.LISTENING_TIMEOUT);
  }

  /**
   * Reset to idle state
   */
  async resetToIdle() {
    this.currentState = State.IDLE;
    this.notifyStateChange('IDLE', 'Say "Aloha" to start');

    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }

    console.log('🔄 Returned to idle state');
  }

  /**
   * Check if transcript contains wake word
   */
  containsWakeWord(transcript) {
    return transcript.includes('aloha') ||
           transcript.includes('hello') ||
           transcript.includes('hey');
  }

  /**
   * Check if transcript contains all command words
   */
  containsCommand(transcript, words) {
    return words.every(word => transcript.includes(word));
  }

  /**
   * Text-to-speech
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
   * Stop listening
   */
  async stopListening() {
    try {
      if (this.isListening) {
        await ExpoSpeechRecognitionModule.stop();
        this.isListening = false;
        console.log('🔇 Voice recognition stopped');
      }
    } catch (error) {
      console.error('Error stopping recognition:', error);
    }
  }

  /**
   * Add command listener
   */
  onCommand(callback) {
    this.listeners.push({ type: 'command', callback });
    return () => {
      this.listeners = this.listeners.filter(l => l.callback !== callback);
    };
  }

  /**
   * Add state change listener
   */
  onStateChange(callback) {
    this.stateChangeListeners.push(callback);
    return () => {
      this.stateChangeListeners = this.stateChangeListeners.filter(l => l !== callback);
    };
  }

  /**
   * Notify command listeners
   */
  notifyCommand(command) {
    this.listeners
      .filter(l => l.type === 'command')
      .forEach(l => l.callback(command));
  }

  /**
   * Notify state change listeners
   */
  notifyStateChange(state, message) {
    this.stateChangeListeners.forEach(callback => {
      callback({ state, message });
    });
  }

  /**
   * Set current mode
   */
  setMode(mode) {
    this.currentMode = mode;
    console.log('🔄 Voice service mode:', mode);
  }

  /**
   * Get current state
   */
  getState() {
    return this.currentState;
  }

  /**
   * Cleanup
   */
  cleanup() {
    this.stopListening();
    this.listeners.forEach(sub => {
      if (sub.remove) sub.remove();
    });
    this.listeners = [];
    this.stateChangeListeners = [];
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
    }
  }
}

export default new VoiceService();
