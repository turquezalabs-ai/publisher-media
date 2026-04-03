/**
 * Twitter API v2 helper for posting media + tweets.
 * Implements OAuth 1.0a signature generation for API authentication.
 *
 * This is a DATA ANALYSIS tool — all published content
 * relates to number frequency, historical data, and educational use.
 */

import { createHmac } from 'crypto';

// ==========================================
// TYPES
// ==========================================

interface TwitterPublishParams {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
  imageUrl: string;
  caption: string;
}

interface OAuthSignatureParams {
  method: string;
  url: string;
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
  oauthParams: Record<string, string>;
}

// ==========================================
// OAUTH 1.0a SIGNATURE GENERATOR
// ==========================================

/**
 * Percent-encode a string according to RFC 3986.
 * Twitter's OAuth expects this specific encoding.
 */
function percentEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A')
    .replace(/~/g, '%7E');
}

/**
 * Generate an OAuth 1.0a HMAC-SHA1 signature.
 */
function generateOAuthSignature(params: OAuthSignatureParams): string {
  const { method, url, apiKey, apiSecret, accessToken, accessTokenSecret, oauthParams } = params;

  // Collect all OAuth parameters
  const allParams: Record<string, string> = {
    ...oauthParams,
    oauth_consumer_key: apiKey,
    oauth_nonce: oauthParams.oauth_nonce || generateNonce(),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: oauthParams.oauth_timestamp || String(Math.floor(Date.now() / 1000)),
    oauth_token: accessToken,
    oauth_version: '1.0',
  };

  // Create the parameter string (sorted, percent-encoded)
  const sortedKeys = Object.keys(allParams).sort();
  const parameterString = sortedKeys
    .map(key => `${percentEncode(key)}=${percentEncode(allParams[key])}`)
    .join('&');

  // Create the base URI (without query params or fragment)
  const urlObj = new URL(url);
  const baseUri = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;

  // Create the signature base string
  const signatureBaseString = `${method.toUpperCase()}&${percentEncode(baseUri)}&${percentEncode(parameterString)}`;

  // Create the signing key
  const signingKey = `${percentEncode(apiSecret)}&${percentEncode(accessTokenSecret)}`;

  // Generate the HMAC-SHA1 signature
  const signature = createHmac('sha1', signingKey)
    .update(signatureBaseString)
    .digest('base64');

  return signature;
}

/**
 * Generate a random nonce string for OAuth.
 */
function generateNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Build the OAuth Authorization header value.
 */
function buildOAuthHeader(params: {
  method: string;
  url: string;
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
  additionalParams?: Record<string, string>;
}): string {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = generateNonce();

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: params.apiKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: params.accessToken,
    oauth_version: '1.0',
    ...(params.additionalParams || {}),
  };

  const signature = generateOAuthSignature({
    method: params.method,
    url: params.url,
    apiKey: params.apiKey,
    apiSecret: params.apiSecret,
    accessToken: params.accessToken,
    accessTokenSecret: params.accessTokenSecret,
    oauthParams,
  });

  // Build header value (exclude oauth_signature from sorted params list for display)
  const headerParts = [
    'OAuth',
    `oauth_consumer_key="${percentEncode(params.apiKey)}"`,
    `oauth_nonce="${percentEncode(nonce)}"`,
    `oauth_signature="${percentEncode(signature)}"`,
    `oauth_signature_method="HMAC-SHA1"`,
    `oauth_timestamp="${percentEncode(timestamp)}"`,
    `oauth_token="${percentEncode(params.accessToken)}"`,
    `oauth_version="1.0"`,
  ];

  return headerParts.join(', ');
}

// ==========================================
// TWITTER MEDIA UPLOAD
// ==========================================

/**
 * Upload media (image) to Twitter using the v1.1 upload endpoint.
 * Accepts a base64-encoded image data string.
 */
async function uploadTwitterMedia(params: {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
  imageBase64: string; // base64-encoded image data (without data URI prefix)
}): Promise<{ success: boolean; mediaId?: string; error?: string }> {
  const { apiKey, apiSecret, accessToken, accessTokenSecret, imageBase64 } = params;
  const uploadUrl = 'https://upload.twitter.com/1.1/media/upload.json';

  try {
    // Build multipart form data
    const boundary = '----TwitterFormBoundary' + Math.random().toString(36).substring(2, 16);

    const parts: Buffer[] = [];
    parts.push(Buffer.from(`--${boundary}\r\n`));
    parts.push(Buffer.from(`Content-Disposition: form-data; name="media_data"\r\n\r\n`));
    parts.push(Buffer.from(imageBase64));
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

    const body = Buffer.concat(parts);

    const oauthHeader = buildOAuthHeader({
      method: 'POST',
      url: uploadUrl,
      apiKey,
      apiSecret,
      accessToken,
      accessTokenSecret,
    });

    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: oauthHeader,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });

    const result = await response.json() as Record<string, unknown>;

    if (result.errors) {
      const errors = Array.isArray(result.errors)
        ? (result.errors as Array<Record<string, unknown>>).map(e => e.message).join('; ')
        : String(result.errors);
      return { success: false, error: `Twitter upload error: ${errors}` };
    }

    const mediaId = result.media_id_string as string;
    if (!mediaId) {
      return { success: false, error: 'Twitter upload did not return a media ID' };
    }

    return { success: true, mediaId };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to upload media to Twitter: ${message}` };
  }
}

// ==========================================
// TWITTER TWEET CREATION
// ==========================================

/**
 * Create a tweet with attached media using the Twitter API v2.
 */
async function createTweet(params: {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
  caption: string;
  mediaId: string;
}): Promise<{ success: boolean; tweetId?: string; error?: string }> {
  const { apiKey, apiSecret, accessToken, accessTokenSecret, caption, mediaId } = params;
  const tweetUrl = 'https://api.twitter.com/2/tweets';

  try {
    const tweetBody = {
      text: caption,
      media: {
        media_ids: [mediaId],
      },
    };

    const oauthHeader = buildOAuthHeader({
      method: 'POST',
      url: tweetUrl,
      apiKey,
      apiSecret,
      accessToken,
      accessTokenSecret,
    });

    const response = await fetch(tweetUrl, {
      method: 'POST',
      headers: {
        Authorization: oauthHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tweetBody),
    });

    const result = await response.json() as Record<string, unknown>;

    if (result.errors) {
      const errors = Array.isArray(result.errors)
        ? (result.errors as Array<Record<string, unknown>>).map(e => e.message).join('; ')
        : String(result.errors);
      return { success: false, error: `Twitter tweet error: ${errors}` };
    }

    const tweetData = result.data as Record<string, unknown> | undefined;
    const tweetId = tweetData?.id as string | undefined;

    if (!tweetId) {
      return { success: false, error: 'Twitter did not return a tweet ID' };
    }

    return { success: true, tweetId };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to create tweet: ${message}` };
  }
}

// ==========================================
// MAIN EXPORT: PUBLISH TO TWITTER
// ==========================================

/**
 * Publish an image with caption to Twitter / X.
 *
 * Flow:
 * 1. Fetch image from URL and convert to base64
 * 2. Upload media to Twitter v1.1 endpoint
 * 3. Create tweet with media using Twitter v2 endpoint
 *
 * Note: Twitter API v1.1 requires OAuth 1.0a for media upload.
 *       Twitter API v2 also uses OAuth 1.0a for tweet creation.
 */
export async function publishToTwitter(params: TwitterPublishParams): Promise<{
  success: boolean;
  tweetId?: string;
  error?: string;
}> {
  const { apiKey, apiSecret, accessToken, accessTokenSecret, imageUrl, caption } = params;

  try {
    // Step 1: Fetch the image and convert to base64
    let imageBase64: string;

    if (imageUrl.startsWith('data:')) {
      // Already a data URI — extract the base64 part
      imageBase64 = imageUrl.replace(/^data:image\/\w+;base64,/, '');
    } else {
      // Fetch from URL
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        return {
          success: false,
          error: `Failed to fetch image from URL: HTTP ${imageResponse.status}`,
        };
      }
      const arrayBuffer = await imageResponse.arrayBuffer();
      imageBase64 = Buffer.from(arrayBuffer).toString('base64');
    }

    // Step 2: Upload media to Twitter
    const uploadResult = await uploadTwitterMedia({
      apiKey,
      apiSecret,
      accessToken,
      accessTokenSecret,
      imageBase64,
    });

    if (!uploadResult.success || !uploadResult.mediaId) {
      return { success: false, error: uploadResult.error || 'Failed to upload media' };
    }

    // Step 3: Create tweet with media
    const tweetResult = await createTweet({
      apiKey,
      apiSecret,
      accessToken,
      accessTokenSecret,
      caption,
      mediaId: uploadResult.mediaId,
    });

    return tweetResult;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to publish to Twitter: ${message}` };
  }
}

/**
 * Publish an image with caption to Twitter / X using base64 image data directly.
 * Skips the URL fetch step — the caller provides the base64 data.
 */
export async function publishToTwitterWithBase64(params: {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
  imageBase64: string; // base64-encoded image data (without data URI prefix)
  caption: string;
}): Promise<{
  success: boolean;
  tweetId?: string;
  error?: string;
}> {
  const { apiKey, apiSecret, accessToken, accessTokenSecret, imageBase64, caption } = params;

  try {
    // Step 1: Upload media
    const uploadResult = await uploadTwitterMedia({
      apiKey,
      apiSecret,
      accessToken,
      accessTokenSecret,
      imageBase64,
    });

    if (!uploadResult.success || !uploadResult.mediaId) {
      return { success: false, error: uploadResult.error || 'Failed to upload media' };
    }

    // Step 2: Create tweet with media
    const tweetResult = await createTweet({
      apiKey,
      apiSecret,
      accessToken,
      accessTokenSecret,
      caption,
      mediaId: uploadResult.mediaId,
    });

    return tweetResult;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to publish to Twitter: ${message}` };
  }
}
