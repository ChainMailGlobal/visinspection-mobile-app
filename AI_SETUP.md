# VIS Eyesight - AI Vision Setup Guide

## Overview
VIS Eyesight is now a **Snap Spectacles-like** AR inspection app that provides:
- **Live camera feed** with real-time AI analysis
- **Continuous vision processing** every 3 seconds
- **Voice narration** of findings (materials, code compliance, defects)
- **Voice commands** for hands-free operation
- **Building code checking** against IBC/IRC standards

## Required API Keys

### 1. OpenAI API Key (Required)
The app uses **GPT-4 Vision** for real-time construction inspection analysis.

**Get your API key:**
1. Go to https://platform.openai.com/api-keys
2. Create a new API key
3. Copy the key (starts with `sk-`)

**Add to .env file:**
```bash
EXPO_PUBLIC_OPENAI_API_KEY=sk-your-actual-key-here
```

### 2. Supabase Credentials (Optional - for backend)
Used for storing projects, building codes database, and inspection photos.

**Get your credentials:**
1. Go to https://supabase.com/dashboard
2. Create a new project or use existing
3. Go to Settings > API
4. Copy the Project URL and anon/public key

**Add to .env file:**
```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

## How It Works

### Live AI Inspection Flow
1. **Open app** → Camera starts automatically
2. **Every 3 seconds** → AI captures frame and analyzes
3. **Voice feedback** → "I see wood framing. Checking spacing... 16 inches on center, IRC compliant"
4. **On-screen overlay** → Shows materials, compliance, issues
5. **Voice commands** → Say "take photo", "mark defect", "building codes"

### AI Analysis Features
- **Material Identification**: Recognizes wood framing, concrete, drywall, etc.
- **Code Compliance**: Checks against IBC 2021/IRC standards
- **Defect Detection**: Flags safety hazards and violations
- **GPS Tagging**: Auto-tags photos with jobsite location
- **Voice Narration**: Speaks findings hands-free

### Voice Commands
- **"Take photo"** - Captures inspection photo with GPS
- **"Mark defect"** - Flags current analysis as issue
- **"Building codes"** - Opens code reference screen
- **"Go home"** - Returns to main menu

## Testing the App

### Development Build (requires dev server)
```bash
eas build --profile development --platform android
```
Download APK → Install → Must connect to dev server

### Preview Build (standalone)
```bash
eas build --profile preview --platform android
```
Download APK → Install → Works independently

### Important Notes
- **Camera must be allowed** for AI vision to work
- **Microphone must be allowed** for voice commands
- **OpenAI API costs** ~$0.01-0.03 per analysis (500 tokens)
- **Frame rate**: Analyzes every 3 seconds to balance speed vs cost
- **Works offline** for camera/voice, requires internet for AI analysis

## Troubleshooting

### "Unable to analyze image"
- Check OpenAI API key in .env
- Verify internet connection
- Check API quota: https://platform.openai.com/usage

### Voice commands not working
- Grant microphone permission in Android settings
- Check voice status badge shows "🎤 Voice Active"
- Speak clearly and wait for recognition

### Camera not showing
- Grant camera permission in Android settings
- Restart app if camera is black screen

## Build for Production

To build with your API keys embedded:

1. Set environment variables in EAS:
```bash
eas secret:create --name EXPO_PUBLIC_OPENAI_API_KEY --value sk-your-key --scope project
eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value https://your-project.supabase.co --scope project
eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value your-key --scope project
```

2. Build production APK:
```bash
eas build --profile production --platform android
```

## Cost Estimates

### OpenAI GPT-4 Vision
- **Per analysis**: ~500 tokens = $0.01-0.03
- **Per hour** (continuous): ~1,200 analyses = $12-36
- **Optimization**: Consider reducing frequency or using GPT-4o-mini

### Recommended Settings
- **Development**: Analyze every 5 seconds
- **Production**: Analyze every 3 seconds
- **Battery saver**: Analyze every 10 seconds or on-demand only

## Next Steps
- [ ] Add your OpenAI API key to `.env`
- [ ] Build preview APK for testing
- [ ] Test voice commands on jobsite
- [ ] Adjust analysis frequency based on needs
- [ ] Configure Supabase for photo storage (optional)
