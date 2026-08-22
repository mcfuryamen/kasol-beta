import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Rate limiting: 10 requests per minute per IP
const rateLimitMap = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 10;
  
  const record = rateLimitMap.get(ip) || { count: 0, windowStart: now };
  if (now - record.windowStart > windowMs) {
    record.count = 0;
    record.windowStart = now;
  }
  if (++record.count > maxRequests) {
    return false;
  }
  rateLimitMap.set(ip, record);
  return true;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Rate limit check
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  if (!checkRateLimit(ip)) {
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded. Try again in a minute.' }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Only allow GET
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Return Supabase config (anon key is public by design)
  const config = {
    url: Deno.env.get('SUPABASE_URL') || 'https://hhywrvedlwljawgxzpkq.supabase.co',
    anonKey: Deno.env.get('SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhoeXdydmVkbHdsamF3Z3h6cGtxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1MzM4OTgsImV4cCI6MjEwMTEwOTg5OH0.GXHRDayBNRbWh1QywGkYCJ6D79qnm_mtyRSJUxw4x50'
  };

  return new Response(
    JSON.stringify(config),
    { 
      status: 200, 
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      } 
    }
  );
});