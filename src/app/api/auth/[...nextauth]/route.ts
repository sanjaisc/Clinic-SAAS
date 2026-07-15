import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import cookie from "cookie";

const handler = NextAuth(authOptions);

/**
 * NextAuth v4 + Next.js 16 compatibility wrapper.
 *
 * NextAuth v4 has built-in Web API Request support via `toInternalRequest()`,
 * but its `req instanceof Request` check fails across module boundaries
 * in Next.js 16 production builds. We manually perform the same conversion.
 */
function toInternalRequest(req: NextRequest) {
  const url = new URL(req.url);
  const nextauth = url.pathname.split("/").slice(3);

  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const query: Record<string, string | string[]> = {
    ...Object.fromEntries(url.searchParams),
    nextauth,
  };

  const rawCookie = req.headers.get("cookie") || "";
  const parsedCookies = cookie.parse(rawCookie);

  const host = headers["x-forwarded-host"] || headers["host"] || "";
  const proto = headers["x-forwarded-proto"] || "http";
  const origin = `${proto}://${host}`;

  return {
    action: nextauth[0] as string,
    method: req.method,
    headers,
    query,
    cookies: parsedCookies,
    providerId: nextauth[1] as string,
    error: (url.searchParams.get("error") || nextauth[1]) as string,
    origin,
    body: undefined as any,
  };
}

function createResponseAdapter() {
  let status = 200;
  const headers: Record<string, string> = {};
  let body: string | null = null;

  const res: any = {
    status(code: number) { status = code; return res; },
    setHeader(key: string, value: string | string[]) {
      headers[key] = Array.isArray(value) ? value.join(", ") : value;
      return res;
    },
    getHeader(key: string) { return headers[key]; },
    json(data: any) { body = JSON.stringify(data); return res; },
    send(data: any) { body = typeof data === "string" ? data : JSON.stringify(data); return res; },
    end(data?: any) { if (data !== undefined) body = String(data); return res; },
    redirect(urlOrStatus: string | number, url?: string) {
      if (typeof urlOrStatus === "number") { status = urlOrStatus; if (url) headers["Location"] = url; }
      else { headers["Location"] = urlOrStatus; }
      return res;
    },
  };

  return { res, getStatus: () => status, getHeaders: () => headers, getBody: () => body };
}

async function handleRequest(req: NextRequest): Promise<Response> {
  const internalReq = toInternalRequest(req);

  // Parse body for POST requests
  if (req.method === "POST") {
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      internalReq.body = Object.fromEntries(new URLSearchParams(text));
    } else if (contentType.includes("application/json")) {
      internalReq.body = await req.json();
    } else {
      try { internalReq.body = await req.json(); } catch { internalReq.body = {}; }
    }
  }

  const { res, getStatus, getHeaders, getBody } = createResponseAdapter();

  try {
    const result = await handler(internalReq as any, res);

    if (result instanceof Response) return result;

    const responseHeaders = new Headers();
    for (const [key, value] of Object.entries(getHeaders())) {
      responseHeaders.append(key, value);
    }
    return new Response(getBody(), { status: getStatus(), headers: responseHeaders });
  } catch (err) {
    console.error("[AUTH] Error:", err);
    return NextResponse.json({ error: "Authentication error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) { return handleRequest(req); }
export async function POST(req: NextRequest) { return handleRequest(req); }