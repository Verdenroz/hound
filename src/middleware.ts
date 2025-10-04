import type { NextRequest } from 'next/server';
import { auth0 } from './lib/auth0';
import { updateSession } from '@/utils/supabase/middleware';

export async function middleware(request: NextRequest) {
  // First handle Supabase session refresh
  const supabaseResponse = await updateSession(request);

  // Then handle Auth0 middleware
  return await auth0.middleware(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
