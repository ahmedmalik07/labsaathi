import { NextResponse } from "next/server";

/**
 * Fallback for a share that arrives before the service worker is active
 * (for example the very first share after installing). The service worker
 * normally answers this request on the device. We do not store anything on
 * the server; we only send the user back to the app with a note.
 */
export async function POST(req: Request) {
  return NextResponse.redirect(new URL("/?shared=retry#top", req.url), 303);
}

export async function GET(req: Request) {
  return NextResponse.redirect(new URL("/#top", req.url), 303);
}
