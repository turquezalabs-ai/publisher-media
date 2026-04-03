import { NextRequest, NextResponse } from 'next/server';
import { publishToTwitterWithBase64 } from '@/lib/publish/twitter';

/**
 * POST /api/publish/twitter
 *
 * Publishes a banner image with caption to Twitter / X.
 * Uses OAuth 1.0a for both media upload and tweet creation.
 *
 * Body:
 *   caption: string      — Tweet text
 *   imageBase64: string  — Base64-encoded image (with or without data URI prefix)
 *   fileName?: string    — Image filename (informational only)
 *
 * Environment:
 *   TWITTER_API_KEY              — Twitter API Key (Consumer Key)
 *   TWITTER_API_SECRET           — Twitter API Secret (Consumer Secret)
 *   TWITTER_ACCESS_TOKEN         — Twitter Access Token
 *   TWITTER_ACCESS_TOKEN_SECRET  — Twitter Access Token Secret
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { caption, imageBase64, fileName } = body as {
      caption?: string;
      imageBase64?: string;
      fileName?: string;
    };

    // Validate required fields
    if (!caption || !imageBase64) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields. Please provide caption and imageBase64.',
        },
        { status: 400 },
      );
    }

    // Check for Twitter credentials
    const apiKey = process.env.TWITTER_API_KEY;
    const apiSecret = process.env.TWITTER_API_SECRET;
    const accessToken = process.env.TWITTER_ACCESS_TOKEN;
    const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;

    if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Twitter API credentials not fully configured. ' +
            'Please add all four variables to your .env.local file:\n' +
            '• TWITTER_API_KEY\n' +
            '• TWITTER_API_SECRET\n' +
            '• TWITTER_ACCESS_TOKEN\n' +
            '• TWITTER_ACCESS_TOKEN_SECRET\n' +
            'Get these from the Twitter Developer Portal (developer.x.com).',
        },
        { status: 500 },
      );
    }

    // Convert base64 to clean format (strip data URI prefix)
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    // Publish to Twitter
    const result = await publishToTwitterWithBase64({
      apiKey,
      apiSecret,
      accessToken,
      accessTokenSecret,
      imageBase64: cleanBase64,
      caption,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to publish to Twitter.',
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      tweetId: result.tweetId,
      platform: 'twitter',
      accountName: 'Twitter / X',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json(
      {
        success: false,
        error: `Server error: ${message}`,
      },
      { status: 500 },
    );
  }
}
