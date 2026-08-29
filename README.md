# Trusty Voice

VoiceShield is an AI-powered cybersecurity system that detects voice-cloning and AI-generated voice impersonation during sensitive phone or VoIP conversations.

The core problem you're solving is this:

An attacker can clone a CEO, CFO, government official, or employee's voice using a few seconds of audio. They can then call an employee and say something like:

"Transfer ₹25 lakh to this account immediately."

Because the voice sounds genuine, the employee may trust the request.

Your system tries to catch that attack before the victim acts.

The basic flow is:

Incoming Call
     ↓
Capture Voice
     ↓
Analyze Audio
     ↓
AI Deepfake Detection
     ↓
Acoustic + Prosody Analysis
     ↓
Caller / Transaction Context
     ↓
Calculate Impersonation Risk
     ↓
┌─────────────────────────┐
│ LOW       → Continue    │
│ MEDIUM    → Verify      │
│ HIGH      → Alert       │
│ CRITICAL  → Block       │
└─────────────────────────┘

For your hackathon prototype, we're simplifying this into a working demonstration:

Voice Recording
      ↓
Wav2Vec2 Anti-Spoofing Model
      ↓
Synthetic Voice Probability
      ↓
Risk Engine
      ↓
Transaction Context
      ↓
VoiceShield Dashboard
      ↓
"ALLOW" / "VERIFY" / "BLOCK"

For example:

A genuine CFO recording:

Spoof probability: 8%
Transaction: ₹2 lakh
Risk: LOW
Action: ALLOW

A cloned CFO voice requesting ₹25 lakh:

Spoof probability: 94%
Transaction: ₹25 lakh
Risk: CRITICAL
Action: BLOCK + MFA / CALL-BACK

The key idea that makes your project stronger is:

"Don't simply detect a deepfake. Turn voice authenticity into an actionable fraud-prevention decision."

So you're essentially building a security layer between voice communication and high-risk actions.

Your eventual product could sit between:

Telecom / VoIP / Enterprise Calls
              ↓
          VoiceShield
              ↓
Banking / Enterprise / Government Workflow

That's the idea we're building.


I need to build a UI  for this

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/bae54a0e-3074-4f52-b23c-aa95b6e343d1).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
