// cspell:words arcjet tokenBucket

// Set environment variables immediately to suppress Arcjet warnings
if (process.env.NODE_ENV === "development") {
  process.env.ARCJET_ENV = "development";
  process.env.ARCJET_DISABLE = "true";
}

// Check if we're in development
const isDev = process.env.NODE_ENV === "development";

let aj;

if (isDev) {
  // In development, use a no-op client to avoid all Arcjet warnings and errors
  aj = {
    protect: async () => ({
      isDenied: () => false,
      reason: undefined,
    }),
  };
} else {
  // Only in production, dynamically import Arcjet to avoid any initialization in dev
  try {
    const arcjetModule = require("@arcjet/next");
    const arcjet = arcjetModule.default || arcjetModule;
    const { tokenBucket } = require("@arcjet/next");
    
    const client = arcjet({
      key: process.env.ARCJET_KEY,
      characteristics: ["userId"],
      rules: [
        tokenBucket({
          mode: "LIVE",
          refillRate: 10,
          interval: 3600,
          capacity: 10,
        }),
      ],
    });

    aj = {
      protect: async (...args) => {
        try {
          if (typeof client.protect === "function") {
            return await client.protect(...args);
          }
          // Fallback if protect method doesn't exist
          return {
            isDenied: () => false,
            reason: undefined,
          };
        } catch (error) {
          // In production, throw the error
          throw error;
        }
      },
    };
  } catch (error) {
    console.error("Failed to initialize Arcjet in production:", error);
    // Fallback to no-op if Arcjet fails to initialize
    aj = {
      protect: async () => ({
        isDenied: () => false,
        reason: undefined,
      }),
    };
  }
}

export default aj;
