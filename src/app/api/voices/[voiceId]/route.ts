import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { getSignedAudioUrl } from "@/lib/storage";

export async function GET(req: Request, { params }: { params: Promise<{ voiceId: string }> }) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { voiceId } = await params;

  const voice = await prisma.voice.findUnique({
    where: { id: voiceId },
    select: {
      variant: true,
      orgId: true,
      storageKey: true,
    },
  });

  if (!voice) {
    return new Response("Not found", { status: 404 });
  }

  if (voice.variant === "CUSTOM" && voice.orgId !== orgId) {
    return new Response("Not found", { status: 400 });
  }

  if(!voice.storageKey) {
    return new Response("Voice has no audio", { status: 409 });
  }

  const signedUrl = await getSignedAudioUrl(voice.storageKey);
  const audioResponse = await fetch(signedUrl);

  if (!audioResponse.ok) {
    return new Response("Failed to fetch voice audio", { status: 502 });
  }

  const contentType = audioResponse.headers.get("content-type") || "audio/wav";

  return new Response(audioResponse.body, {
    headers: {
      "content-type": contentType,
      "Cache-Control": voice.variant === "SYSTEM" ? "public, max-age=86400" : "private, max-age=3600",
    },
  });
};