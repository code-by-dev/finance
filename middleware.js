// middleware.js (project root mein hona chahiye)
import arcjet, { createMiddleware, detectBot, shield } from "@arcjet/next";
import { createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { clerkMiddleware } from '@clerk/nextjs/server';

// 1. Define route matcher
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/account(.*)",
  "/transaction(.*)",
]);

// 2. Define ArcJet middleware
const aj = arcjet({
  key: process.env.ARCJET_KEY,
  rules: [
    shield({ mode: "LIVE" }),
    detectBot({
      mode: "DRY_RUN",
      allow: ["CATEGORY:SEARCH_ENGINE", "GO_HTTP"],
    }),
  ],
});

// 3. Define Clerk middleware
const clerk = clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

  if (!userId && isProtectedRoute(req)) {
    const { redirectToSignIn } = await auth();
    return redirectToSignIn();
  }

  return NextResponse.next();
});

// 4. ✅ Now call createMiddleware (after aj and clerk defined)
export default createMiddleware(aj, clerk);

// 5. Matcher config
export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
