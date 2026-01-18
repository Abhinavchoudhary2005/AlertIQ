// hooks/useVoiceDetection.ts
import { useEffect, useRef } from "react";
import { Audio } from "expo-av";

// Global state to ensure only one instance runs
let activeInstance: string | null = null;
let globalRecording: Audio.Recording | null = null;
let shouldStop = false;

export const useVoiceDetection = (
  apiUrl: string | undefined,
  onSOSDetected: () => Promise<void>,
) => {
  const instanceIdRef = useRef(Math.random().toString(36).slice(2, 8));
  const hasStartedRef = useRef(false);

  useEffect(() => {
    const instanceId = instanceIdRef.current;
    if (!apiUrl) {
      console.log("⚠️ API URL not provided, voice detection disabled");
      return;
    }

    // Only allow one instance to run
    if (activeInstance && activeInstance !== instanceId) {
      console.log(
        `⚠️ Already running (active: ${activeInstance}, this: ${instanceId})`,
      );
      return;
    }

    // Prevent double-start in same instance
    if (hasStartedRef.current) {
      console.log(`⚠️ Already started this instance (${instanceId})`);
      return;
    }

    hasStartedRef.current = true;
    activeInstance = instanceId;
    shouldStop = false;

    const startVoiceDetection = async () => {
      console.log(`🎙️ Voice detection started (${instanceId})`);

      // Request microphone permission
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        console.log("❌ Microphone permission denied");
        activeInstance = null;
        return;
      }

      console.log("✅ Microphone permission granted");

      // Set audio mode
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
      } catch (e) {
        console.log("⚠️ Audio mode setup failed:", e);
      }

      console.log("🔄 Starting monitoring loop");

      // Main monitoring loop
      while (!shouldStop && activeInstance === instanceId) {
        try {
          // Clean up previous recording
          if (globalRecording) {
            try {
              await globalRecording.stopAndUnloadAsync();
            } catch (e) {
              console.log("⚠️ Error stopping previous recording:", e);
            }
            globalRecording = null;
          }

          // Check if we should continue
          if (shouldStop || activeInstance !== instanceId) {
            console.log("🛑 Stop signal received");
            break;
          }

          // Create new recording
          const recording = new Audio.Recording();
          globalRecording = recording;

          console.log("🔴 Recording 3s...");

          await recording.prepareToRecordAsync({
            android: {
              extension: ".wav",
              outputFormat: Audio.AndroidOutputFormat.DEFAULT,
              audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
            },
            ios: {
              extension: ".wav",
              outputFormat: Audio.IOSOutputFormat.LINEARPCM,
              audioQuality: Audio.IOSAudioQuality.HIGH,
              sampleRate: 16000,
              numberOfChannels: 1,
              bitRate: 128000,
              linearPCMBitDepth: 16,
              linearPCMIsBigEndian: false,
              linearPCMIsFloat: false,
            },
            web: {},
          });
          await recording.startAsync();

          // Record for 3 seconds
          await new Promise((resolve) => setTimeout(resolve, 3000));

          // Check again before stopping
          if (shouldStop || activeInstance !== instanceId) {
            console.log("🛑 Stop during recording");
            await recording.stopAndUnloadAsync();
            globalRecording = null;
            break;
          }

          console.log("⏹️ Stopping...");
          await recording.stopAndUnloadAsync();

          const uri = recording.getURI();
          globalRecording = null;

          if (!uri) {
            console.log("⚠️ No URI");
            continue;
          }

          console.log("📤 Analyzing...");
          console.log("🔗 API URL:", `${apiUrl}/analyze-voice`);
          console.log("📁 File URI:", uri);

          // Create FormData
          const formData = new FormData();
          formData.append("file", {
            uri: uri,
            name: "voice.wav",
            type: "audio/wav",
          } as any);

          // Send to API with timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout (increased for Whisper processing)

          console.log("📡 Sending request...");
          const res = await fetch(`${apiUrl}/analyze-voice`, {
            method: "POST",
            body: formData,
            headers: {
              Accept: "application/json",
            },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);
          console.log("✅ Response received:", res.status);

          if (!res.ok) {
            const errorText = await res.text();
            console.log(`❌ API error ${res.status}:`, errorText.slice(0, 100));

            // If 502, the server is down or overloaded
            if (res.status === 502) {
              console.log("⚠️ Server unavailable - waiting 5s before retry");
              await new Promise((resolve) => setTimeout(resolve, 5000));
            } else {
              await new Promise((resolve) => setTimeout(resolve, 2000));
            }
            continue;
          }

          // Parse the response - FastAPI returns a string directly
          const responseText = await res.text();
          console.log("📝 Response:", responseText);

          // Parse the string as JSON (it should be a JSON string)
          let data;
          try {
            data = JSON.parse(responseText);
          } catch {
            console.log("⚠️ Failed to parse response as JSON:", responseText);
            await new Promise((resolve) => setTimeout(resolve, 2000));
            continue;
          }

          // Check if unsafe
          if (data.unsafe === true) {
            console.log("🚨 UNSAFE DETECTED!");
            console.log(`📝 "${data.english_text}"`);
            console.log(`⚡ ${data.trigger}`);

            // Trigger SOS
            await onSOSDetected();

            // Stop monitoring
            console.log("🛑 Stopping after SOS");
            shouldStop = true;
            break;
          } else {
            console.log("✅ Safe");
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          const errorName = err instanceof Error ? err.name : "Unknown";
          console.log("❌ Error:", errorMsg);
          console.log("❌ Error type:", errorName);

          // Check if it's a timeout
          if (errorName === "AbortError") {
            console.log(
              "⏱️ Request timed out - server is taking too long to process",
            );
            console.log(
              "💡 Consider: using a faster Whisper model (tiny/base) or GPU",
            );
            await new Promise((resolve) => setTimeout(resolve, 5000));
          }
          // Check if it's a network error
          else if (errorMsg.includes("Network request failed")) {
            console.log("🔍 Possible causes:");
            console.log("  - API server not running");
            console.log("  - Wrong API URL");
            console.log("  - Network connectivity issue");
            console.log("  - CORS or firewall blocking");
            console.log("  - Using HTTP instead of HTTPS on iOS");
            await new Promise((resolve) => setTimeout(resolve, 2000));
          } else {
            // Other errors
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }
      }

      console.log(`🎙️ Voice detection stopped (${instanceId})`);

      // Final cleanup
      if (globalRecording) {
        try {
          await globalRecording.stopAndUnloadAsync();
        } catch (e) {
          console.log("⚠️ Error stopping recording:", e);
        }
        globalRecording = null;
      }

      // Clear active instance if it's still us
      if (activeInstance === instanceId) {
        activeInstance = null;
      }
    };

    startVoiceDetection();

    // Cleanup function
    return () => {
      console.log(`🧹 Cleanup (${instanceId})`);

      // Signal to stop
      shouldStop = true;

      // Only clear if we're the active instance
      if (activeInstance === instanceId) {
        activeInstance = null;
      }

      // Clean up recording
      if (globalRecording) {
        globalRecording
          .stopAndUnloadAsync()
          .catch(() => {})
          .finally(() => {
            globalRecording = null;
          });
      }
    };
  }, [apiUrl, onSOSDetected]);

  return null;
};
