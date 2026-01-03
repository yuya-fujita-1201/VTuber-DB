import { YouTubeService } from '../services/youtube.js';
import { enqueueJob } from './job-utils.js';

const CHANNEL_ID_REGEX = /UC[a-zA-Z0-9_-]{22,}/;

function extractChannelId(input) {
  const match = input.match(CHANNEL_ID_REGEX);
  return match ? match[0] : null;
}

function extractHandle(input) {
  if (input.startsWith('@')) {
    return input.slice(1).split(/[/?#]/)[0];
  }
  const match = input.match(/\/(@[^/?#]+)/);
  if (match) {
    return match[1].replace('@', '');
  }
  return null;
}

function extractUser(input) {
  const match = input.match(/\/user\/([^/?#]+)/);
  return match ? match[1] : null;
}

function extractCustom(input) {
  const match = input.match(/\/c\/([^/?#]+)/);
  return match ? match[1] : null;
}

async function resolveChannelIdByHandle(handle, apiKey) {
  const url = `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(handle)}&key=${apiKey}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`YouTube API error: ${response.status}`);
  }
  const data = await response.json();
  return data.items?.[0]?.id || null;
}

async function resolveChannelIdByUsername(username, apiKey) {
  const url = `https://www.googleapis.com/youtube/v3/channels?part=id&forUsername=${encodeURIComponent(username)}&key=${apiKey}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`YouTube API error: ${response.status}`);
  }
  const data = await response.json();
  return data.items?.[0]?.id || null;
}

async function resolveChannelIdBySearch(query, youtubeService) {
  const results = await youtubeService.searchChannels(query, 1);
  return results[0]?.channel_id || null;
}

export async function resolveChannelJob(env, payload) {
  const db = env.DB;
  const { url, ingestion_request_id } = payload || {};

  if (!url) {
    throw new Error('Missing url in payload');
  }
  if (!env.YOUTUBE_API_KEY) {
    throw new Error('Missing YOUTUBE_API_KEY');
  }

  const input = String(url).trim();
  const youtubeService = new YouTubeService(env.YOUTUBE_API_KEY);

  let channelId = extractChannelId(input);
  if (!channelId) {
    const handle = extractHandle(input);
    if (handle) {
      channelId = await resolveChannelIdByHandle(handle, env.YOUTUBE_API_KEY);
      if (!channelId) {
        channelId = await resolveChannelIdBySearch(handle, youtubeService);
      }
    }
  }

  if (!channelId) {
    const username = extractUser(input);
    if (username) {
      channelId = await resolveChannelIdByUsername(username, env.YOUTUBE_API_KEY);
      if (!channelId) {
        channelId = await resolveChannelIdBySearch(username, youtubeService);
      }
    }
  }

  if (!channelId) {
    const customName = extractCustom(input);
    if (customName) {
      channelId = await resolveChannelIdBySearch(customName, youtubeService);
    }
  }

  if (!channelId) {
    const fallbackQuery = input.replace(/^@/, '');
    channelId = await resolveChannelIdBySearch(fallbackQuery, youtubeService);
  }

  if (!channelId) {
    throw new Error('Unable to resolve channel ID');
  }

  const { results: existing } = await db
    .prepare('SELECT vtuber_id FROM youtube_channels WHERE channel_id = ?')
    .bind(channelId)
    .all();

  if (existing.length > 0) {
    if (ingestion_request_id) {
      await db
        .prepare('UPDATE ingestion_requests SET status = ? WHERE id = ?')
        .bind('duplicate', ingestion_request_id)
        .run();
    }

    return {
      status: 'duplicate',
      channel_id: channelId,
      vtuber_id: existing[0].vtuber_id,
    };
  }

  await enqueueJob(
    db,
    'initial_sync_channel',
    { channel_id: channelId, ingestion_request_id },
    { priority: 4, dedupe: { channel_id: channelId } }
  );

  return { status: 'queued', channel_id: channelId };
}
