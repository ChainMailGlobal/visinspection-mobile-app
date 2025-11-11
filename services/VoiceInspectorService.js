/**
 * VoiceInspectorService - React Native adaptation of OpenAI Realtime API
 * Adapted from web implementation for use with react-native-webrtc and expo-av
 */

import 'react-native-url-polyfill/auto';
import { RTCPeerConnection, RTCSessionDescription, mediaDevices } from 'react-native-webrtc';
import { Audio } from 'expo-av';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/env';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export class VoiceInspectorService {
  constructor(callbacks = {}) {
    this.pc = null;
    this.dc = null;
    this.sound = null;
    this.callbacks = callbacks;
    this.isSpeaking = false;
    this.localStream = null;

    // Configure audio session for playback
    this.initAudio();
  }

  async initAudio() {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      console.log('🔊 [VoiceInspector] Audio session configured');
    } catch (e) {
      console.warn('⚠️ [VoiceInspector] Could not configure audio session:', e);
    }
  }

  async init(projectId, inspectionType, projectName = '', comments = '') {
    try {
      console.log('🎤 [VoiceInspector] Starting initialization for', inspectionType, 'inspection');

      // Check authentication first
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('❌ [VoiceInspector] No active session');
        throw new Error("Not authenticated. Please log in again.");
      }
      console.log('✅ [VoiceInspector] Session verified');

      // Get ephemeral token from edge function
      console.log('🔑 [VoiceInspector] Requesting OpenAI ephemeral token...');

      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('realtime-token', {
        body: { projectId, inspectionType, projectName, comments },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        }
      });

      if (tokenError || !tokenData?.client_secret?.value) {
        console.error('❌ [VoiceInspector] Token fetch failed:', tokenError);
        const errorMsg = tokenError?.message || "Failed to get ephemeral token";
        throw new Error(`${errorMsg}. Please check your internet connection and try again.`);
      }
      console.log('✅ [VoiceInspector] Token obtained');

      const EPHEMERAL_KEY = tokenData.client_secret.value;

      // Create peer connection with TURN servers for NAT traversal
      console.log('🔗 [VoiceInspector] Creating RTCPeerConnection...');
      this.pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          },
          {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          }
        ]
      });

      // Monitor connection state
      this.pc.onconnectionstatechange = () => {
        console.log('📡 [VoiceInspector] Connection state:', this.pc?.connectionState);
      };

      this.pc.oniceconnectionstatechange = () => {
        console.log('🧊 [VoiceInspector] ICE connection state:', this.pc?.iceConnectionState);
      };

      // Set up remote audio track handler
      this.pc.ontrack = async (e) => {
        console.log('🎵 [VoiceInspector] Received remote audio track');
        try {
          // In React Native, we need to create a MediaStream and play it
          // react-native-webrtc doesn't support direct stream playback like web
          // We'll handle audio through the data channel events instead
          const stream = e.streams[0];

          // Store stream for potential future use
          this.remoteStream = stream;

          console.log('🔊 [VoiceInspector] Remote audio track received');
        } catch (err) {
          console.error('❌ [VoiceInspector] Error handling remote audio:', err);
        }
      };

      // Add local audio track
      console.log('🎙️ [VoiceInspector] Requesting microphone access...');
      this.localStream = await mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      this.localStream.getTracks().forEach(track => {
        this.pc.addTrack(track, this.localStream);
      });
      console.log('✅ [VoiceInspector] Local audio track added');

      // Set up data channel for events
      console.log('📨 [VoiceInspector] Creating data channel...');
      this.dc = this.pc.createDataChannel("oai-events");

      this.dc.onopen = () => {
        console.log('✅ [VoiceInspector] Data channel OPEN - AI is ready!');
        try {
          // Kick off initial response so the agent greets user after connection
          this.dc?.send(JSON.stringify({ type: 'response.create' }));
          console.log('👋 [VoiceInspector] Sent initial greeting trigger');
        } catch (e) {
          console.warn('⚠️ [VoiceInspector] Failed to trigger initial response:', e);
        }
      };

      this.dc.onmessage = (e) => {
        const event = JSON.parse(e.data);
        this.handleEvent(event);
      };

      this.dc.onclose = () => {
        console.log('🔌 [VoiceInspector] Data channel CLOSED');
      };

      this.dc.onerror = (e) => {
        console.error('❌ [VoiceInspector] Data channel error:', e);
      };

      // Create and set local description
      console.log('📝 [VoiceInspector] Creating SDP offer...');
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      console.log('✅ [VoiceInspector] Local description set');

      // Exchange SDP via backend to avoid client-side CORS/network issues
      console.log('🤖 [VoiceInspector] Exchanging SDP via backend function');
      const { data: sdpData, error: sdpError } = await supabase.functions.invoke('realtime-sdp', {
        body: {
          offerSdp: offer.sdp,
          ephemeralKey: EPHEMERAL_KEY,
          model: 'gpt-4o-realtime-preview-2024-12-17',
        },
      });

      if (sdpError || !sdpData?.sdp) {
        console.error('❌ [VoiceInspector] Backend SDP exchange failed:', sdpError, sdpData);
        const msg = sdpError?.message || sdpData?.details || 'Unknown SDP exchange error';
        throw new Error(`SDP exchange failed via backend: ${msg}`);
      }
      console.log('✅ [VoiceInspector] SDP exchange successful via backend');

      const answer = new RTCSessionDescription({
        type: 'answer',
        sdp: sdpData.sdp,
      });

      await this.pc.setRemoteDescription(answer);
      console.log('✅ [VoiceInspector] Remote description set - CONNECTION COMPLETE!');
      console.log('🎉 [VoiceInspector] AI Voice Inspector is LIVE with building codes loaded');

      return true;
    } catch (error) {
      console.error("❌ [VoiceInspector] Initialization failed:", error);
      if (error instanceof Error) {
        console.error('Error details:', error.message, error.stack);
      }
      throw error;
    }
  }

  handleEvent(event) {
    console.log('📬 Voice inspector event:', event.type);

    // Call general message callback
    if (this.callbacks.onMessage) {
      this.callbacks.onMessage(event);
    }

    // Handle specific event types
    switch (event.type) {
      case 'conversation.item.input_audio_transcription.completed':
        if (this.callbacks.onTranscript) {
          this.callbacks.onTranscript(event.transcript, true);
        }
        break;

      case 'response.audio.delta':
        if (!this.isSpeaking) {
          this.isSpeaking = true;
          if (this.callbacks.onSpeaking) {
            this.callbacks.onSpeaking(true);
          }
        }
        break;

      case 'response.audio.done':
        if (this.isSpeaking) {
          this.isSpeaking = false;
          if (this.callbacks.onSpeaking) {
            this.callbacks.onSpeaking(false);
          }
        }
        break;

      case 'response.function_call_arguments.done':
        this.handleFunctionCall(event);
        break;

      case 'response.done':
        // Parse response for violations
        if (event.response?.output) {
          this.parseForViolations(event.response.output);
        }
        break;
    }
  }

  handleFunctionCall(event) {
    const functionName = event.name;
    let args = {};

    try {
      args = event.arguments ? JSON.parse(event.arguments) : {};
    } catch (e) {
      console.error('Failed to parse function arguments:', e);
    }

    console.log('🔧 Function call:', functionName, args);

    switch (functionName) {
      case 'start_recording':
        if (this.callbacks.onStartRecording) {
          this.callbacks.onStartRecording();
        }
        break;

      case 'stop_recording':
        if (this.callbacks.onStopRecording) {
          this.callbacks.onStopRecording();
        }
        break;

      case 'take_photo':
        if (this.callbacks.onTakePhoto) {
          this.callbacks.onTakePhoto(args.note);
        }
        break;

      case 'flag_violation':
        if (this.callbacks.onViolation) {
          this.callbacks.onViolation(args);
        }
        break;

      case 'scan_complete':
        if (this.callbacks.onScanComplete) {
          this.callbacks.onScanComplete(args.summary || 'Scan complete');
        }
        break;
    }
  }

  parseForViolations(output) {
    // Look for structured violation data in the response
    if (Array.isArray(output)) {
      output.forEach(item => {
        if (item.type === 'function_call' && item.name === 'flag_violation') {
          if (this.callbacks.onViolation) {
            this.callbacks.onViolation(item.arguments);
          }
        }
      });
    }
  }

  async sendVisionFrame(base64Image) {
    if (!this.dc || this.dc.readyState !== 'open') {
      console.warn('⚠️ Data channel not ready for vision frame');
      return;
    }

    try {
      // Send image for analysis
      this.dc.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'input_image',
              image: base64Image
            }
          ]
        }
      }));

      // Trigger response
      this.dc.send(JSON.stringify({ type: 'response.create' }));
      console.log('📸 Vision frame sent');
    } catch (error) {
      console.error('❌ Error sending vision frame:', error);
    }
  }

  async sendText(text) {
    if (!this.dc || this.dc.readyState !== 'open') {
      throw new Error('Data channel not ready');
    }

    this.dc.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text
          }
        ]
      }
    }));

    this.dc.send(JSON.stringify({ type: 'response.create' }));
    console.log('💬 Text message sent:', text);
  }

  disconnect() {
    console.log('🔌 Disconnecting VoiceInspector');

    try {
      if (this.dc && this.dc.readyState === 'open') {
        this.dc.close();
      }
      this.dc = null;
    } catch (e) {
      console.error('Error closing data channel:', e);
    }

    try {
      // Stop local tracks
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop());
        this.localStream = null;
      }
    } catch (e) {
      console.error('Error stopping local stream:', e);
    }

    try {
      if (this.pc && this.pc.signalingState !== 'closed') {
        this.pc.close();
      }
      this.pc = null;
    } catch (e) {
      console.error('Error closing peer connection:', e);
    }

    try {
      if (this.sound) {
        this.sound.unloadAsync();
        this.sound = null;
      }
    } catch (e) {
      console.error('Error cleaning up audio:', e);
    }
  }
}
