import { BlobServiceClient, StorageSharedKeyCredential, generateBlobSASQueryParameters, BlobSASPermissions,} from "@azure/storage-blob";
import { env } from "./env";

const blobServiceClient = BlobServiceClient.fromConnectionString(
  env.AZURE_STORAGE_CONNECTION_STRING,
);

const containerClient = blobServiceClient.getContainerClient(
  env.AZURE_STORAGE_CONTAINER,
);

type UploadAudioOptions = {
  buffer: Buffer;
  key: string;
  contentType?: string;
};

export async function uploadAudio({
  buffer,
  key,
  contentType = "audio/wav",
}: UploadAudioOptions): Promise<void> {
  const blockBlobClient = containerClient.getBlockBlobClient(key);
  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: contentType },
  });
}

export async function deleteAudio(key: string): Promise<void> {
  const blockBlobClient = containerClient.getBlockBlobClient(key);
  await blockBlobClient.deleteIfExists();
}

export async function getSignedAudioUrl(key: string): Promise<string> {
  const blockBlobClient = containerClient.getBlockBlobClient(key);

  const expiresOn = new Date(Date.now() + 3600 * 1000); // 1 hour

  // SAS signing needs the account key from the connection string.
  const sharedKeyCredential =
    blockBlobClient.credential instanceof StorageSharedKeyCredential
      ? blockBlobClient.credential
      : undefined;

  if (!sharedKeyCredential) {
    throw new Error(
      "AZURE_STORAGE_CONNECTION_STRING must use an account key to generate SAS URLs.",
    );
  }

  const sas = generateBlobSASQueryParameters(
    {
      containerName: env.AZURE_STORAGE_CONTAINER, // which container: "voices"
      blobName: key, // which blob: "voices/system/<id>"
      permissions: BlobSASPermissions.parse("r"), // what you're allowed to do: read only
      expiresOn, // when it stops working: now + 1 hour
    },
    sharedKeyCredential,
  ).toString();

  return `${blockBlobClient.url}?${sas}`;
}
