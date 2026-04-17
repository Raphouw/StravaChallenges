export interface StravaSegmentEffort {
  id: number;
  segment: {
    id: number;
    name: string;
    distance: number;
    elevation_gain: number;
  };
  elapsed_time: number;
  moving_time: number;
  start_date: string;
  distance: number;
  elevation_gain: number;
  average_watts?: number;
  average_cadence?: number;
}

export interface StravaActivity {
  id: number;
  name: string;
  segment_efforts: StravaSegmentEffort[];
}

export async function getStravaActivity(
  activityId: number,
  accessToken: string
): Promise<StravaActivity> {
  const response = await fetch(
    `https://www.strava.com/api/v3/activities/${activityId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Strava API error: ${response.status}`);
  }

  return response.json() as Promise<StravaActivity>;
}

export async function getStravaSegment(
  segmentId: number,
  accessToken: string
): Promise<any> {
  const response = await fetch(
    `https://www.strava.com/api/v3/segments/${segmentId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Strava segment fetch failed: ${response.status}`);
  }

  const segment = await response.json() as any;
  console.log('[strava-client] segment raw keys:', Object.keys(segment));
  console.log('[strava-client] elevation fields:', {
    total_elevation_gain: segment.total_elevation_gain,
    elevation_high: segment.elevation_high,
    elevation_low: segment.elevation_low,
  });

  return segment;
}

export async function refreshStravaToken(
  refreshToken: string
): Promise<{
  access_token: string;
  refresh_token: string;
  expires_at: number;
}> {
  const response = await fetch('https://www.strava.com/api/v3/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: process.env.STRAVA_CLIENT_ID || '',
      client_secret: process.env.STRAVA_CLIENT_SECRET || '',
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error(`Strava token refresh failed: ${response.status}`);
  }

  return response.json() as Promise<{
    access_token: string;
    refresh_token: string;
    expires_at: number;
  }>;
}
