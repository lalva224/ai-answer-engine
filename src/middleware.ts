// TODO: Implement the code here to add rate limiting with Redis
// Refer to the Next.js Docs: https://nextjs.org/docs/app/building-your-application/routing/middleware
// Refer to Redis docs on Rate Limiting: https://upstash.com/docs/redis/sdks/ratelimit-ts/algorithms
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Redis } from '@upstash/redis'
import { Ratelimit } from "@upstash/ratelimit"; // for deno: see above

const redis = Redis.fromEnv();

// Define the rate limiter for fixed window (10 requests per 10 seconds)
const ratelimit= new Ratelimit({
  redis, // Use Redis instance
  limiter: Ratelimit.slidingWindow(`0`, "10 s"), // 10 requests per 10 seconds
  analytics: true, // Optional: Enable analytics if needed
});
//this runs before home page
export async function middleware(req: NextRequest) {
  // const ip  = req.headers.get('x-forwarded-for') ?? '127.0.0.1'
  // console.log(ip)
  // const {success, remaining, reset} = await ratelimit.limit(ip);
  // if (!success) {
  //   console.log('RATE LIMIT EXCEEDED')
  //   return NextResponse.json('Rate Limit Exceeded', { status: 429 });
  // }
  
  // return NextResponse.json('Rate Limit Not Exceeded', { status: 200 });
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
