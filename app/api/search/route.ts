import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://uokbyvwpgpjdkxeyhjkq.supabase.co';
// This is a public, publishable browser-safe key, not a service-role secret.
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_OwML8AzzknUvxsWa2RDnFA_QGCvjFTu';

export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get('q') || '').trim();
  if (query.length < 2 || query.length > 160) return NextResponse.json({ results: [] });
  try {
    const client = createClient(supabaseUrl, publishableKey, { auth: { persistSession: false } });
    const { data, error } = await client.rpc('search_websites', { query_text: query, result_limit: 25 });
    if (error) throw error;
    return NextResponse.json({ results: data || [] }, { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } });
  } catch {
    return NextResponse.json({ error: 'Search temporarily unavailable' }, { status: 503 });
  }
}
