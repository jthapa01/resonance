import createClient from "openapi-fetch";
import type { paths } from "@/types/chatterbox-api";
import { env } from "./env";

// SERVER-ONLY: holds CHATTERBOX_API_KEY. Never import this into a client component
// or the shared secret leaks to the browser. Types come from `npm run sync-api`.
export const chatterbox = createClient<paths>({
  baseUrl: env.CHATTERBOX_API_URL,
  headers: {
    "x-api-key": env.CHATTERBOX_API_KEY,
  },
});
