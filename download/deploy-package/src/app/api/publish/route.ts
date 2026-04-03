import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/publish
 *
 * Unified publishing endpoint that handles all platforms.
 * This is the single endpoint the PublishPanel component calls.
 *
 * Body:
 *   platform: 'facebook' | 'instagram' | 'twitter' | 'tiktok'
 *   accounts: Array<{
 *     id: string;
 *     pageId: string;
 *     igUserId?: string;   // Required for Instagram accounts
 *     name: string;
 *   }>
 *   caption: string          — Post caption
 *   imageBase64: string      — Base64-encoded banner image
 *   fileName: string         — Image filename
 *   testMode: boolean        — If true, simulates without calling APIs
 */

interface PublishAccount {
  id: string;
  pageId: string;
  igUserId?: string;
  name: string;
}

interface PublishRequestBody {
  platform: string;
  accounts: PublishAccount[];
  caption: string;
  imageBase64: string;
  fileName: string;
  testMode: boolean;
}

interface PublishResult {
  accountId: string;
  accountName: string;
  platform: string;
  status: 'success' | 'error';
  message: string;
  postId?: string;
  postUrl?: string;
}

/**
 * Simulate a publish operation for test mode.
 * Adds a small delay and returns a mock result.
 */
function simulatePublish(account: PublishAccount, platform: string): PublishResult {
  const success = Math.random() > 0.1; // 90% simulated success rate
  const platformLabels: Record<string, string> = {
    facebook: 'Facebook',
    instagram: 'Instagram',
    twitter: 'Twitter / X',
    tiktok: 'TikTok',
  };
  const label = platformLabels[platform] || platform;

  return {
    accountId: account.id,
    accountName: account.name,
    platform,
    status: success ? 'success' : 'error',
    message: success
      ? `Test Mode — Post to ${label} would be published successfully. No actual post was created.`
      : `Test Mode — Simulated ${label} API issue (token / permissions). No actual request was made.`,
    postId: success ? `test-${Date.now()}-${account.id}` : undefined,
  };
}

/**
 * Actually publish to a specific platform API.
 * Calls the platform-specific route handler logic directly (internal fetch).
 */
async function actualPublish(
  platform: string,
  account: PublishAccount,
  caption: string,
  imageBase64: string,
  fileName: string,
  baseUrl: string,
): Promise<PublishResult> {
  let endpointUrl: string;
  let requestBody: Record<string, unknown>;

  switch (platform) {
    case 'facebook':
      endpointUrl = `${baseUrl}/api/publish/facebook`;
      requestBody = {
        pageId: account.pageId,
        caption,
        imageBase64,
        fileName,
      };
      break;

    case 'instagram':
      endpointUrl = `${baseUrl}/api/publish/instagram`;
      if (!account.igUserId) {
        return {
          accountId: account.id,
          accountName: account.name,
          platform,
          status: 'error',
          message: 'Instagram Business Account ID (igUserId) is required. Add it when configuring this account.',
        };
      }
      requestBody = {
        igUserId: account.igUserId,
        pageId: account.pageId,
        caption,
        imageBase64,
        fileName,
      };
      break;

    case 'twitter':
      endpointUrl = `${baseUrl}/api/publish/twitter`;
      requestBody = {
        caption,
        imageBase64,
        fileName,
      };
      break;

    case 'tiktok':
      return {
        accountId: account.id,
        accountName: account.name,
        platform: 'tiktok',
        status: 'error',
        message: 'TikTok publishing is not yet supported. Please remove TikTok accounts or use Test Mode.',
      };

    default:
      return {
        accountId: account.id,
        accountName: account.name,
        platform,
        status: 'error',
        message: `Unknown platform: ${platform}. Supported: facebook, instagram, twitter.`,
      };
  }

  try {
    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const result = await response.json() as Record<string, unknown>;

    if (result.success) {
      return {
        accountId: account.id,
        accountName: account.name,
        platform,
        status: 'success',
        message: `Published to ${platform} successfully.`,
        postId: result.postId as string | result.mediaId as string | result.tweetId as string | undefined,
        postUrl: result.postUrl as string | undefined,
      };
    } else {
      return {
        accountId: account.id,
        accountName: account.name,
        platform,
        status: 'error',
        message: (result.error as string) || `Failed to publish to ${platform}.`,
      };
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Network error';
    return {
      accountId: account.id,
      accountName: account.name,
      platform,
      status: 'error',
      message: `Connection error when publishing to ${platform}: ${message}`,
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PublishRequestBody;
    const { platform, accounts, caption, imageBase64, fileName, testMode } = body;

    // Validate required fields
    if (!platform || !accounts || !Array.isArray(accounts) || !caption || !imageBase64) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: platform, accounts, caption, imageBase64.',
        },
        { status: 400 },
      );
    }

    if (accounts.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No accounts selected. Please select at least one account to publish.',
        },
        { status: 400 },
      );
    }

    // Determine base URL for internal API calls
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 3000}`;

    // Process each account
    const results: PublishResult[] = [];
    const platformLabels: Record<string, string> = {
      facebook: 'Facebook',
      instagram: 'Instagram',
      twitter: 'Twitter / X',
      tiktok: 'TikTok',
    };

    for (const account of accounts) {
      if (testMode) {
        // Simulate with a small delay
        await new Promise(r => setTimeout(r, 300 + Math.random() * 400));
        results.push(simulatePublish(account, platform));
      } else {
        // Actually publish
        const result = await actualPublish(
          platform,
          account,
          caption,
          imageBase64,
          fileName,
          baseUrl,
        );
        results.push(result);
      }
    }

    // Summary
    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;
    const label = platformLabels[platform] || platform;

    return NextResponse.json({
      success: errorCount === 0,
      results,
      summary: {
        platform: label,
        total: results.length,
        succeeded: successCount,
        failed: errorCount,
        testMode,
      },
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
