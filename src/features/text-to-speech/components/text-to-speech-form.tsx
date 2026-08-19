"use client";

import { z } from "zod";
import { formOptions } from "@tanstack/react-form";
import { useAppForm } from "@/hooks/use-app-form";

const ttsFormSchema = z.object({
  text: z.string().min(1, "Please enter some text"),
  voiceId: z.string().min(1, "Please select a voice"),
  temperature: z.number(),
  topP: z.number(),
  topK: z.number(),
  repetitionPenalty: z.number(),
});

export type TTSFormValues = z.infer<typeof ttsFormSchema>;

export const defaultTTSValues: TTSFormValues = {
  text: "",
  voiceId: "",
  temperature: 0.8,
  topP: 0.95,
  topK: 1000,
  repetitionPenalty: 1.2,
};

export const ttsFormOptions = formOptions({
  defaultValues: defaultTTSValues,
});

export function TextToSpeechForm({
  defaultValues,
  children,
}: {
  defaultValues?: TTSFormValues;
  children: React.ReactNode;
}) {
  const form = useAppForm({
    ...ttsFormOptions,
    defaultValues: defaultValues ?? defaultTTSValues,
    validators: {
      onSubmit: ttsFormSchema,
    },
    onSubmit: async (values) => {
      // Generation logic would go here, but for now we just log the values
      console.log("Form submitted with values:", values);
    }
  });

  return <form.AppForm>{children}</form.AppForm>
}