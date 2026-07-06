import { NextRequest, NextResponse } from "next/server";

// =============================================================================
// GET — Geocode a ZIP/postal code to lat/lng using Nominatim (free, no key)
// =============================================================================
// Query params:
//   q — ZIP/postal code (e.g. "10001" or "10005")
// =============================================================================

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();

  if (!q) {
    return NextResponse.json(
      { error: "Query parameter 'q' is required", code: "MISSING_QUERY" },
      { status: 400 }
    );
  }

  // Basic validation — allow US ZIP (5 digits, optional +4), Canadian postal, or generic
  if (!/^[A-Za-z0-9\s\-]{3,12}$/.test(q)) {
    return NextResponse.json(
      { error: "Invalid ZIP/postal code format", code: "INVALID_FORMAT" },
      { status: 400 }
    );
  }

  try {
    // Use Nominatim with a structured query for better ZIP code resolution
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=us&limit=1&addressdetails=1`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": "DoctA/1.0 (medical-booking-app)",
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Geocoding service unavailable", code: "GEOCODE_UNAVAILABLE" },
        { status: 502 }
      );
    }

    const data: NominatimResult[] = await res.json();

    if (data.length === 0) {
      return NextResponse.json(
        { error: "Could not find location for that ZIP code", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const result = data[0];
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);

    if (isNaN(lat) || isNaN(lon)) {
      return NextResponse.json(
        { error: "Invalid coordinates returned", code: "INVALID_COORDS" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      lat,
      lng: lon,
      displayName: result.display_name,
    });
  } catch (error) {
    console.error("[GEOCODE] Error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}