import dotenv from 'dotenv';
import path from 'path';
import { dirname } from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const WEBHOOK_VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN;
const APP_URL = process.env.APP_URL || 'strava-challenges-extension.vercel.app';

if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET || !WEBHOOK_VERIFY_TOKEN) {
  console.error('Missing required environment variables:');
  if (!STRAVA_CLIENT_ID) console.error('  - STRAVA_CLIENT_ID');
  if (!STRAVA_CLIENT_SECRET) console.error('  - STRAVA_CLIENT_SECRET');
  if (!WEBHOOK_VERIFY_TOKEN) console.error('  - WEBHOOK_VERIFY_TOKEN');
  process.exit(1);
}

async function registerWebhook() {
  const callbackUrl = `https://${APP_URL}/api/webhook/strava`;

  console.log('Registering Strava webhook...');
  console.log(`Callback URL: ${callbackUrl}`);
  console.log(`Verify Token: ${WEBHOOK_VERIFY_TOKEN}`);

  try {
    const response = await fetch('https://www.strava.com/api/v3/push_subscriptions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        callback_url: callbackUrl,
        verify_token: WEBHOOK_VERIFY_TOKEN,
      }).toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Failed to register webhook:', data);
      process.exit(1);
    }

    console.log('✓ Webhook registered successfully!');
    console.log('Subscription ID:', data.id);
    console.log('Created at:', data.created_at);
    console.log('Callback URL:', data.callback_url);
  } catch (error) {
    console.error('Error registering webhook:', error);
    process.exit(1);
  }
}

registerWebhook();
