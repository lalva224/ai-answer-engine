// TODO: Implement the code here to add rate limiting with Redis
// Refer to the Next.js Docs: https://nextjs.org/docs/app/building-your-application/routing/middleware
// Refer to Redis docs on Rate Limiting: https://upstash.com/docs/redis/sdks/ratelimit-ts/algorithms
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

const redis = Redis.fromEnv();
const rateLimiter = new Ratelimit({
  redis: redis,
  analytics: true,
  prefix: "rate-limit",
  limiter: Ratelimit.slidingWindow(2, "60 s"),
});

export async function middleware(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const { success, limit, remaining } = await rateLimiter.limit(ip);
    const response = success
      ? NextResponse.next()
      : NextResponse.json(
          { error: "Too many requests for you Salif" },
          { status: 429 }
        );

    response.headers.set("X-RateLimit-Limit", limit.toString());
    response.headers.set("X-RateLimit-Reset", limit.toString());
    response.headers.set("X-RateLimit-Remaining", remaining.toString());
    return response;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error: unknown) {
    return NextResponse.json(
      { error: "Internal server error " + error },
      { status: 500 }
    );
  }
}

// Configure which paths the middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except static files and images
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
