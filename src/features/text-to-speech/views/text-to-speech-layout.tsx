import { PageHeader } from "@/components/page-header";

export function TextToSpeechLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-0 overflow-hidden flex-col">
      <PageHeader title="Text-to-Speech" />
      {children}
    </div>
  );
};