import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import { useCallback } from "react";

// Native recorder — wraps expo-audio. Returns a uniform interface shared with
// the web implementation (recorder.web.js).
export function useRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const start = useCallback(async () => {
    const perm = await AudioModule.requestRecordingPermissionsAsync();
    if (!perm.granted) {
      throw new Error("Microphone permission denied.");
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
  }, [recorder]);

  // Returns a descriptor the uploader can append to FormData.
  const stop = useCallback(async () => {
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false });
    const uri = recorder.uri;
    if (!uri) return null;
    return { uri, name: "recording.m4a", type: "audio/m4a" };
  }, [recorder]);

  return { start, stop };
}
