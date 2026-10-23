import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://uokbyvwpgpjdkxeyhjkq.supabase.co';
// This is a public, publishable browser-safe key, not a service-role secret.
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_OwML8AzzknUvxsWa2RDnFA_QGCvjFTu';

export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get('q') || '').trim();
  const page = Math.min(1000, Math.max(1, Number.parseInt(request.nextUrl.searchParams.get('page') || '1', 10) || 1));
  if (query.length < 2 || query.length > 160) return NextResponse.json({ results: [], page, totalPages: 0, total: 0 });
  try {
    const client = createClient(supabaseUrl, publishableKey, { auth: { persistSession: false } });
    const { data, error } = await client.rpc('search_websites_paged', { query_text: query, page_number: page, page_size: 15 });
    if (error) throw error;
    const rows=data || [];
    const total=Number(rows[0]?.total_count || 0);
    return NextResponse.json({ results: rows.map(({total_count, ...rest}: {total_count: number; [key:string]:unknown}) => rest), page, total, totalPages: Math.ceil(total / 15) }, { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } });
  } catch {
    return NextResponse.json({ error: 'Search temporarily unavailable' }, { status: 503 });
  }
}
