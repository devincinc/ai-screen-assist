# AI Screen Assist Backend

A Python WebSocket server that processes screen captures and audio, providing AI-powered assistance. It uses various AI models for speech transcription, multimodal processing, and text-to-speech conversion.

## Features

* WebSocket server for real-time communication
* Speech detection and transcription
* Image processing for screen captures
* AI-powered responses based on screen content and audio
* Text-to-speech conversion for AI responses

## Prerequisites

* Python 3.9 or higher
* CUDA-capable GPU (recommended for optimal performance)
* Required Python packages listed in requirements.txt

## Getting Started

1. Install required packages

```bash
pip install -r requirements.txt
```

2. Install espeak for TTS fallback (Linux/Ubuntu)

```bash
apt-get -qq -y install espeak-ng
```

3. Run the server

```bash
python main.py
```

The server will start on port 9073.