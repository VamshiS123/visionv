# VisionVoice

VisionVoice is a mobile-first web app that provides continuous ambient narration using the Overshoot SDK. It analyzes live video from your camera and provides natural, batched narration of your environment with smooth transitions.

## Features

- **Continuous Ambient Narration** - Describes the environment naturally as you move, prioritizing navigation-critical information
- **Batched Speech** - Groups observations over 2-second windows and summarizes them intelligently
- **Smooth Transitions** - Uses similarity detection to avoid redundant narration and provides natural language transitions
- **Priority Handling** - Critical observations (hazards, navigation) interrupt immediately, while others wait for batch summarization
- **Context-Aware** - Remembers recent descriptions to provide context-aware narration

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- An Overshoot API key (get one at [Overshoot Platform](https://overshoot.ai))

### Installation

1. Clone or navigate to the project directory:
```bash
cd visionvoice
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```bash
cp .env.example .env
```

4. Add your API keys to `.env`:
```
VITE_OVERSHOOT_API_URL=https://cluster1.overshoot.ai/api/v0.2
VITE_OVERSHOOT_API_KEY=your-overshoot-api-key-here
VITE_MURF_API_KEY=your-murf-api-key-here
VITE_MURF_VOICE_ID=en-US-natalie
```

Get your API keys:
- **Overshoot API Key**: Get one at [Overshoot Platform](https://overshoot.ai)
- **Murf AI API Key**: Get one at [Murf AI](https://murf.ai)

### Running the App

Start the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:3000`

### Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Architecture

The app consists of three main layers:

1. **Overshoot Integration Layer** (`useOvershoot.ts`)
   - Handles video analysis and result streaming
   - Supports camera input (mobile-first, environment-facing)
   - Configurable processing parameters

2. **Batching & Transition Layer**
   - `BatchedSpeechManager` - Batches observations and manages speech synthesis
   - `NarrationOrchestrator` - Handles similarity detection and context management
   - `useNarrationTransition` - Orchestrates transitions between narration states

3. **Speech Output Layer** (`useBatchedSpeech.ts`)
   - Uses Murf AI API for high-quality text-to-speech
   - Manages speech queue and interruptions
   - Handles priority-based speech scheduling

## Configuration

### Environment Variables

- `VITE_OVERSHOOT_API_URL` - Overshoot API endpoint (default: https://cluster1.overshoot.ai/api/v0.2)
- `VITE_OVERSHOOT_API_KEY` - Your Overshoot API key (required)
- `VITE_NARRATION_TRANSITION_DELAY` - Delay in ms before processing transitions (default: 500)
- `VITE_NARRATION_CONTEXT_SIZE` - Number of recent descriptions to keep in context (default: 5)

### Processing Parameters

The Overshoot SDK is configured with:
- `clip_length_seconds: 1` - Window size for analysis
- `delay_seconds: 1` - Frequency of results
- `fps: 30` - Maximum frames per second
- `sampling_ratio: 0.1` - Fraction of frames to analyze (10%)

### Batching Configuration

- `batchInterval: 2000` - Time in ms between batch summaries (2 seconds)
- `format: MP3` - Audio format (MP3, WAV, FLAC, etc.)
- `sampleRate: 44100` - Audio sample rate (8000, 24000, 44100, 48000)
- `rate: 10` - Speech rate adjustment (-50 to +50, 0 is normal)
- `pitch: 0` - Pitch adjustment (-50 to +50, 0 is normal)

## How It Works

1. **Video Analysis**: Overshoot SDK analyzes camera feed and provides descriptions every ~1 second
2. **Similarity Detection**: NarrationOrchestrator compares new descriptions with recent context
3. **Batching**: Non-critical observations are batched over 2-second windows
4. **Summarization**: Batched observations are deduplicated and summarized into natural sentences
5. **Speech Synthesis**: Summaries are converted to speech using Web Speech API
6. **Transitions**: Natural language transitions are added ("The scene continues...", "Now I see...")

## Priority System

Observations are prioritized as follows:
- **Critical** - Immediate interruption (hazards, obstacles, navigation-critical)
- **High** - New scenes or significant changes
- **Medium** - Regular updates (default)
- **Low** - Minor changes

## Mobile-First Design

The app is optimized for mobile devices:
- Responsive layout that works on phones and tablets
- Touch-friendly controls
- Environment-facing camera (back camera) by default
- Optimized for portrait orientation

## Troubleshooting

### Speech Not Working

If speech narration is not working, try the following:

1. **Murf AI API Key**: Ensure you have set `VITE_MURF_API_KEY` in your `.env` file:
   - Get your API key from [Murf AI](https://murf.ai)
   - Make sure the key is valid and has credits available

2. **Check Console**: Open browser developer tools (F12) and check the console for:
   - "Murf AI API key configured" message
   - Any error messages from the Murf AI API
   - "Calling Murf AI API" messages when speech is triggered
   - "Audio playback started" messages

3. **API Errors**: Common Murf AI API errors:
   - `401 Unauthorized` - Invalid API key
   - `429 Too Many Requests` - Rate limit exceeded or no credits
   - `400 Bad Request` - Invalid request parameters (check voiceId, format, etc.)

4. **Test Speech**: When you toggle voice narration on, you should hear "Voice narration enabled". If you don't hear this:
   - Check that your Murf AI API key is correct
   - Verify you have credits/quota available
   - Check browser console for API errors
   - Verify the voiceId is valid (e.g., "en-US-natalie", "Matthew")

5. **Audio Playback**: Ensure:
   - Device volume is up
   - Browser is not muted
   - Page is in focus
   - No browser extensions blocking audio

6. **Network Issues**: Murf AI requires internet connection:
   - Check your internet connection
   - Verify no firewall is blocking API requests to `api.murf.ai`

### Debug Mode

The app includes extensive console logging. To debug speech issues:
1. Open browser developer tools (F12)
2. Check the Console tab
3. Look for messages like:
   - "Adding observation: ..."
   - "Processing batch of X observations"
   - "Speech started: ..."
   - "Speech ended: ..."

## Future Enhancements

- On-demand Q&A mode (press button or hotword to ask specific questions)
- Context-aware memory for follow-up questions
- Custom voice selection
- Export narration history
- Offline mode support

## License

ISC
