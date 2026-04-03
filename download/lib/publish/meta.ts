/**
 * Meta API helper for Facebook + Instagram publishing.
 * Uses the Facebook Graph API v21.0.
 *
 * This is a DATA ANALYSIS tool — all published content
 * relates to number frequency, historical data, and educational use.
 */

const META_GRAPH_API = 'https://graph.facebook.com/v21.0';

// ==========================================
// TYPES
// ==========================================

interface FacebookPublishParams {
  pageAccessToken: string;
  pageId: string;
  imageUrl: string;
  caption: string;
}

interface InstagramPublishParams {
  pageAccessToken: string;
  pageId: string;
  instagramBusinessAccountId: string;
  imageUrl: string;
  caption: string;
}

interface TokenExchangeParams {
  pageAccessToken: string;
  appId: string;
  appSecret: string;
}

// ==========================================
// FACEBOOK PUBLISHING
// ==========================================

/**
 * Post an image with caption to a Facebook Page.
 * Uses the /photos endpoint with a publicly accessible image URL.
 */
export async function publishToFacebook(params: FacebookPublishParams): Promise<{
  success: boolean;
  postId?: string;
  error?: string;
}> {
  const { pageAccessToken, pageId, imageUrl, caption } = params;

  try {
    const url = `${META_GRAPH_API}/${pageId}/photos`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pageAccessToken}`,
      },
      body: JSON.stringify({
        url: imageUrl,
        message: caption,
        access_token: pageAccessToken,
      }),
    });

    const result = await response.json();

    if (result.error) {
      return {
        success: false,
        error: `Facebook API error (${result.error.code}): ${result.error.message}`,
      };
    }

    return {
      success: true,
      postId: result.id,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: `Failed to publish to Facebook: ${message}`,
    };
  }
}

/**
 * Post an image with caption to a Facebook Page using multipart form data.
 * This version accepts a Buffer (for base64-encoded images) instead of a URL.
 */
export async function publishToFacebookWithBuffer(params: {
  pageAccessToken: string;
  pageId: string;
  imageBuffer: Buffer;
  fileName: string;
  mimeType: string;
  caption: string;
}): Promise<{
  success: boolean;
  postId?: string;
  postUrl?: string;
  error?: string;
}> {
  const { pageAccessToken, pageId, imageBuffer, fileName, mimeType, caption } = params;

  try {
    const boundary = '----FormBoundary' + Math.random().toString(36).substring(2, 16);
    const url = `${META_GRAPH_API}/${pageId}/photos`;

    // Build multipart body
    const parts: Buffer[] = [];

    // Image file part
    const fileHeader = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="source"; filename="${fileName}"\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`
    );
    parts.push(fileHeader);
    parts.push(imageBuffer);
    parts.push(Buffer.from('\r\n'));

    // Caption/message part
    const messagePart = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="message"\r\n\r\n` +
      `${caption}\r\n`
    );
    parts.push(messagePart);

    // Closing boundary
    parts.push(Buffer.from(`--${boundary}--\r\n`));

    const body = Buffer.concat(parts);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${pageAccessToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });

    const result = await response.json();

    if (result.error) {
      return {
        success: false,
        error: `Facebook API error (${result.error.code}): ${result.error.message}`,
      };
    }

    return {
      success: true,
      postId: result.id,
      postUrl: result.post_id ? `https://facebook.com/${result.post_id}` : undefined,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: `Failed to publish to Facebook: ${message}`,
    };
  }
}

// ==========================================
// INSTAGRAM PUBLISHING
// ==========================================

/**
 * Post an image with caption to an Instagram Business Account via Meta Graph API.
 * Uses the Content Publishing API (create media container → publish).
 *
 * IMPORTANT: The imageUrl must be publicly accessible.
 */
export async function publishToInstagram(params: InstagramPublishParams): Promise<{
  success: boolean;
  mediaId?: string;
  error?: string;
}> {
  const { pageAccessToken, instagramBusinessAccountId, imageUrl, caption } = params;

  try {
    // Step 1: Create a media container
    const containerUrl = `${META_GRAPH_API}/${instagramBusinessAccountId}/media`;
    const containerResponse = await fetch(containerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pageAccessToken}`,
      },
      body: JSON.stringify({
        image_url: imageUrl,
        caption: caption,
        access_token: pageAccessToken,
      }),
    });

    const containerResult = await containerResponse.json();

    if (containerResult.error) {
      return {
        success: false,
        error: `Instagram container error (${containerResult.error.code}): ${containerResult.error.message}`,
      };
    }

    const containerId: string = containerResult.id;

    // Step 2: Publish the container
    const publishUrl = `${META_GRAPH_API}/${instagramBusinessAccountId}/media_publish`;
    const publishResponse = await fetch(publishUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pageAccessToken}`,
      },
      body: JSON.stringify({
        creation_id: containerId,
        access_token: pageAccessToken,
      }),
    });

    const publishResult = await publishResponse.json();

    if (publishResult.error) {
      return {
        success: false,
        error: `Instagram publish error (${publishResult.error.code}): ${publishResult.error.message}`,
      };
    }

    return {
      success: true,
      mediaId: publishResult.id,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: `Failed to publish to Instagram: ${message}`,
    };
  }
}

/**
 * Upload an image to Facebook as an unpublished photo to get a publicly accessible URL.
 * This is used as an intermediary step for Instagram publishing with base64 images.
 */
export async function uploadUnpublishedPhoto(params: {
  pageAccessToken: string;
  pageId: string;
  imageBuffer: Buffer;
  fileName: string;
  mimeType: string;
}): Promise<{
  success: boolean;
  photoId?: string;
  imageUrl?: string;
  error?: string;
}> {
  const { pageAccessToken, pageId, imageBuffer, fileName, mimeType } = params;

  try {
    const boundary = '----FormBoundary' + Math.random().toString(36).substring(2, 16);
    const url = `${META_GRAPH_API}/${pageId}/photos`;

    const parts: Buffer[] = [];

    // Image file part
    const fileHeader = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="source"; filename="${fileName}"\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`
    );
    parts.push(fileHeader);
    parts.push(imageBuffer);
    parts.push(Buffer.from('\r\n'));

    // Published = false
    const publishedPart = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="published"\r\n\r\n` +
      `false\r\n`
    );
    parts.push(publishedPart);

    // Closing boundary
    parts.push(Buffer.from(`--${boundary}--\r\n`));

    const body = Buffer.concat(parts);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${pageAccessToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });

    const result = await response.json();

    if (result.error) {
      return {
        success: false,
        error: `Upload error (${result.error.code}): ${result.error.message}`,
      };
    }

    const photoId: string = result.id;

    // Step 2: Get the photo URL from the uploaded photo
    const photoUrl = `${META_GRAPH_API}/${photoId}?fields=images`;
    const photoResponse = await fetch(photoUrl, {
      headers: {
        Authorization: `Bearer ${pageAccessToken}`,
      },
    });

    const photoResult = await photoResponse.json();

    if (photoResult.error || !photoResult.images || photoResult.images.length === 0) {
      return {
        success: false,
        error: `Could not retrieve uploaded photo URL: ${photoResult.error?.message || 'No images returned'}`,
      };
    }

    // Use the largest available image
    const imageUrl = photoResult.images[0].source;

    return {
      success: true,
      photoId,
      imageUrl,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: `Failed to upload unpublished photo: ${message}`,
    };
  }
}

/**
 * Publish to Instagram using a buffer (base64) image instead of a URL.
 * Internally uploads to Facebook as unpublished, gets URL, then publishes to IG.
 */
export async function publishToInstagramWithBuffer(params: {
  pageAccessToken: string;
  pageId: string;
  instagramBusinessAccountId: string;
  imageBuffer: Buffer;
  fileName: string;
  mimeType: string;
  caption: string;
}): Promise<{
  success: boolean;
  mediaId?: string;
  error?: string;
}> {
  const { pageAccessToken, pageId, instagramBusinessAccountId, imageBuffer, fileName, mimeType, caption } = params;

  try {
    // Step 1: Upload to Facebook as unpublished to get a public URL
    const uploadResult = await uploadUnpublishedPhoto({
      pageAccessToken,
      pageId,
      imageBuffer,
      fileName,
      mimeType,
    });

    if (!uploadResult.success || !uploadResult.imageUrl) {
      return {
        success: false,
        error: uploadResult.error || 'Failed to upload intermediary photo',
      };
    }

    // Step 2: Use the URL for Instagram Content Publishing
    return publishToInstagram({
      pageAccessToken,
      pageId,
      instagramBusinessAccountId,
      imageUrl: uploadResult.imageUrl,
      caption,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: `Failed to publish to Instagram: ${message}`,
    };
  }
}

// ==========================================
// TOKEN EXCHANGE
// ==========================================

/**
 * Exchange a short-lived page access token for a long-lived one (valid for 60 days).
 */
export async function exchangePageToken(params: TokenExchangeParams): Promise<{
  success: boolean;
  longLivedToken?: string;
  expiresIn?: number;
  error?: string;
}> {
  const { pageAccessToken, appId, appSecret } = params;

  try {
    const url = new URL(`${META_GRAPH_API}/oauth/access_token`);
    url.searchParams.set('grant_type', 'fb_exchange_token');
    url.searchParams.set('client_id', appId);
    url.searchParams.set('client_secret', appSecret);
    url.searchParams.set('fb_exchange_token', pageAccessToken);

    const response = await fetch(url.toString(), {
      method: 'GET',
    });

    const result = await response.json();

    if (result.error) {
      return {
        success: false,
        error: `Token exchange error (${result.error.code}): ${result.error.message}`,
      };
    }

    return {
      success: true,
      longLivedToken: result.access_token,
      expiresIn: result.expires_in,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: `Failed to exchange token: ${message}`,
    };
  }
}
