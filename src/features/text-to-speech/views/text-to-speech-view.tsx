"use client";

import { TextInputPanel } from "@/features/text-to-speech/components/text-input-panel";
import { VoicePreviewPlaceholder } from "@/features/text-to-speech/components/voice-preview-placeholder";
import { SettingsPanel } from "@/features/text-to-speech/components/settings-panel";
import { TextToSpeechForm, defaultTTSValues, type TTSFormValues } from "@/features/text-to-speech/components/text-to-speech-form";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { TTSVoicesProvider } from "../contexts/tts-voices-context";

export function TextToSpeechView({ initialValues, initialVoiceName }: { initialValues?: Partial<TTSFormValues>; initialVoiceName?: string; }) {
  const trpc = useTRPC();
  const { data: voices } = useSuspenseQuery(trpc.voices.getAll.queryOptions());
  const { custom: customVoices, system: systemVoices } = voices;
  const allVoices = [...customVoices, ...systemVoices];
  const fallbackVoiceId = allVoices[0]?.id ?? "";

  // Precedence: explicit voiceId (kept as-is so an unknown id surfaces as
  // "Unavailable voice") -> voice name lookup (from quick actions) -> first voice.
  const resolvedVoiceId =
    initialValues?.voiceId ||
    allVoices.find((v) => v.name === initialVoiceName)?.id ||
    fallbackVoiceId;

  const defaultValues: TTSFormValues = {
    ...defaultTTSValues,
    ...initialValues,
    voiceId: resolvedVoiceId,
  };

  return (
    <TTSVoicesProvider value={{ customVoices, systemVoices, allVoices }}>
      <TextToSpeechForm defaultValues={defaultValues}>
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col">
            <TextInputPanel />
            <VoicePreviewPlaceholder />
          </div>
          <SettingsPanel />
        </div>
      </TextToSpeechForm>
    </TTSVoicesProvider>
  );
}