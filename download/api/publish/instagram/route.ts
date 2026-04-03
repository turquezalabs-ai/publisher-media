import { NextRequest, NextResponse } from 'next/server';
import { publishToInstagramWithBuffer } from '@/lib/publish/meta';

/**
 * POST /api/publish/instagram
 *
 * Publishes a banner image with caption to an Instagram Business Account
 * via the Meta Content Publishing API.
 *
 * Flow:
 *   1. Upload image to Facebook as unpublished photo (to get a public URL)
 *   2. Create Instagram media container with the URL
 *   3. Publish the container to Instagram
 *
 * Body:
 *   igUserId: string      — Instagram Business Account ID (from Meta Graph API)
 *   pageId: string        — Facebook Page ID (linked to the Instagram account)
 *   caption: string       — Post caption
 *   imageBase64: string   — Base64-encoded image (with or without data URI prefix)
 *   fileName?: string     — Image filename (default: banner.png)
 *
 * Environment:
 *   META_ACCESS_TOKEN     — Long-lived Facebook Page access token
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { igUserId, pageId, caption, imageBase64, fileName } = body as {
      igUserId?: string;
      pageId?: string;
      caption?: string;
      imageBase64?: string;
      fileName?: string;
    };

    // Validate required fields
    if (!igUserId || !pageId || !caption || !imageBase64) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Missing required fields. Please provide igUserId, pageId, caption, and imageBase64.',
        },
        { status: 400 },
      );
    }

    // Check for access token
    const accessToken = process.env.META_ACCESS_TOKEN;
    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Instagram publishing requires a Meta access token. Add META_ACCESS_TOKEN to your .env.local file. ' +
            'You need a Facebook Page linked to your Instagram Business Account. ' +
            'Get a long-lived page token from the Meta for Developers dashboard.',
        },
        { status: 500 },
      );
    }

    // Convert base64 to buffer
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(cleanBase64, 'base64');

    // Determine MIME type
    let mimeType = 'image/png';
    const mimeMatch = imageBase64.match(/^data:(image\/\w+);base64,/);
    if (mimeMatch) {
      mimeType = mimeMatch[1];
    }

    const name = fileName || 'banner.png';

    // Publish to Instagram (handles the intermediary Facebook upload internally)
    const result = await publishToInstagramWithBuffer({
      pageAccessToken: accessToken,
      pageId,
      instagramBusinessAccountId: igUserId,
      imageBuffer,
      fileName: name,
      mimeType,
      caption,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to publish to Instagram.',
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      mediaId: result.mediaId,
      platform: 'instagram',
      accountName: igUserId,
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
