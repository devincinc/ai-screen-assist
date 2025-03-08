import React, { useRef, useState, useEffect } from "react";
import { Base64 } from 'js-base64';
import { useWebSocket } from "./WebSocketProvider";

interface ChatMessage {
  text: string;
  timestamp: string;
}

const ScreenShare: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null);
  const setupInProgressRef = useRef(false);
  const [isSharing, setIsSharing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([{
    text: "Screen sharing session started. I'll transcribe what I see.",
    timestamp: new Date().toLocaleTimeString()
  }]);
  const { sendMessage, sendMediaChunk, isConnected, playbackAudioLevel, lastMessage } = useWebSocket();
  const captureIntervalRef = useRef<NodeJS.Timeout>();

  // Handle incoming messages
  useEffect(() => {
    if (lastMessage) {
      setMessages(prev => [...prev, {
        text: lastMessage,
        timestamp: new Date().toLocaleTimeString()
      }]);
    }
  }, [lastMessage]);

  const startSharing = async () => {
    if (isSharing) return;

    try {
      // Get screen stream
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });
      
      // Get audio stream
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 16000
        }
      });

      // Set up audio context and processing
      audioContextRef.current = new AudioContext({
        sampleRate: 16000,
        latencyHint: 'interactive'
      });

      const ctx = audioContextRef.current;
      await ctx.audioWorklet.addModule('/worklets/audio-processor.js');
      
      const source = ctx.createMediaStreamSource(audioStream);
      audioWorkletNodeRef.current = new AudioWorkletNode(ctx, 'audio-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        processorOptions: {
          sampleRate: 16000,
          bufferSize: 4096,
        },
        channelCount: 1,
        channelCountMode: 'explicit',
        channelInterpretation: 'speakers'
      });

      // Set up audio processing
      audioWorkletNodeRef.current.port.onmessage = (event) => {
        const { pcmData, level } = event.data;
        setAudioLevel(level);
        
        if (pcmData) {
          const base64Data = Base64.fromUint8Array(new Uint8Array(pcmData));
          sendMediaChunk({
            mime_type: "audio/pcm",
            data: base64Data
          });
        }
      };

      source.connect(audioWorkletNodeRef.current);
      audioStreamRef.current = audioStream;

      // Set up video stream and capture
      if (videoRef.current) {
        videoRef.current.srcObject = screenStream;
        
        // Start screen capture interval
        captureIntervalRef.current = setInterval(() => {
          if (videoRef.current) {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(videoRef.current, 0, 0);
              const imageData = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
              
              sendMediaChunk({
                mime_type: "image/jpeg",
                data: imageData
              });
            }
          }
        }, 3000);
      }

      // Send initial setup message
      sendMessage({
        setup: {
          // Add any needed config options
        }
      });

      setIsSharing(true);
    } catch (err) {
      console.error('Failed to start sharing:', err);
      stopSharing();
    }
  };

  const stopSharing = () => {
    // Stop video stream
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }

    // Stop audio stream
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }

    // Stop screen capture interval
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = undefined;
    }

    // Clean up audio processing
    if (audioWorkletNodeRef.current) {
      audioWorkletNodeRef.current.disconnect();
      audioWorkletNodeRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setIsSharing(false);
    setAudioLevel(0);
  };

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-3xl">
      {/* Welcome Header */}
      <div className="text-center space-y-2">
        <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">
          Welcome to AI Screen Sharing Assistant
        </h1>
        <p className="text-xl text-muted-foreground">
          Share your screen and talk to me
        </p>
      </div>

      {/* Screen Preview */}
      <div className="w-full md:w-[640px] mx-auto bg-white shadow-md rounded-lg p-6">
        <div className="flex flex-col items-center space-y-4">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full aspect-video rounded-md border bg-muted"
          />
          {/* Combined Audio Level Indicator */}
          {isSharing && (
            <div className="w-full space-y-2">
              <div className="h-2 w-full bg-gray-200 rounded">
                <div 
                  className="h-2 bg-black rounded"
                  style={{ width: `${Math.max(audioLevel, playbackAudioLevel)}%` }}
                />
              </div>
            </div>
          )}
          {!isSharing ? (
            <button 
              className={`px-4 py-2 rounded-md ${isConnected ? 'bg-black text-white' : 'bg-gray-200 text-gray-700'}`}
              onClick={startSharing}
              disabled={!isConnected}
            >
              {isConnected ? "Start Screen Share" : "Connecting to server..."}
            </button>
          ) : (
            <button 
              className="px-4 py-2 rounded-md bg-red-600 text-white"
              onClick={stopSharing}
            >
              Stop Sharing
            </button>
          )}
        </div>
      </div>

      {/* Chat History */}
      <div className="w-full md:w-[640px] mx-auto bg-white shadow-md rounded-lg overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold">Chat History</h3>
        </div>
        <div className="h-[400px] overflow-y-auto p-4">
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div 
                key={index} 
                className="flex items-start space-x-4 rounded-lg p-4 bg-gray-100"
              >
                <div className="h-8 w-8 rounded-full flex items-center justify-center bg-black">
                  <span className="text-xs font-medium text-white">AI</span>
                </div>
                <div className="space-y-1">
                  <p className="text-sm leading-loose">{message.text}</p>
                  <p className="text-xs text-gray-500">{message.timestamp}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScreenShare;