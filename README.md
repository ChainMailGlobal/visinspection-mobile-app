# VIS Eyesight

AI-powered visual inspection platform for construction - "Build Right As You Go"

## Overview

VIS Eyesight is a mobile app that provides real-time AI vision inspection for construction jobsites. Using GPT-4 Vision and voice control, it enables hands-free operation perfect for inspectors wearing Snap Spectacles or using mobile devices.

## Three-Phase Workflow

1. **Foresight** - Pre-submission plan validation against building codes
2. **Eyesight** - Real-time AR jobsite verification (ACTIVE)
3. **Hindsight** - Post-construction compliance documentation (Coming Soon)

## Features

- **Voice Control**: "Aloha" greeting and hands-free commands
- **AI Vision**: Real-time analysis with GPT-4 Vision
- **Category Detection**: Electrical, plumbing, structural, fire safety, HVAC
- **Severity Overlays**: Color-coded warnings (yellow, orange, red)
- **Building Codes**: Local jurisdictional code compliance checking
- **Photo Capture**: GPS-tagged inspection photos
- **Defect Marking**: Voice or touch-based defect logging
- **Material ID**: AI-powered material identification
- **Plan Overlay**: Building plan overlay with AprilTag calibration (planned)
- **PDF Reports**: Auto-generated inspection documentation

## Tech Stack

- Expo SDK 54
- React Native 0.81.5
- OpenAI GPT-4 Vision API
- expo-speech-recognition for voice
- expo-camera for real-time capture
- EAS Build for iOS/Android

## Setup

1. Clone the repo
2. Copy `.env.example` to `.env` and add your OpenAI API key
3. Install dependencies: `npm install --legacy-peer-deps`
4. Run: `npx expo start`

## Building

- Android Preview: `eas build --profile preview --platform android`
- iOS Preview: `eas build --profile preview --platform ios`

## Value Proposition

One prevented rework pays for the platform.

---

Built with [Claude Code](https://claude.com/claude-code)
