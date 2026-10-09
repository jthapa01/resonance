import { VoicesLayout } from "@/features/voices/views/voices-layout";

export default function VoicesLayoutPage({
  children,
}: {
  children: React.ReactNode;
}) {
  return <VoicesLayout>{children}</VoicesLayout>;
}