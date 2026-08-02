import cache from 'memory-cache';
import { xml2json } from 'xml-js';

import { formatApiCall } from 'utils/proxy/api-helpers';
import { httpProxy } from 'utils/proxy/http';
import getServiceWidget from 'utils/config/service-helpers';
import createLogger from 'utils/logger';
import widgets from 'widgets/widgets';

const proxyName = 'plexRecentProxyHandler';
const logger = createLogger(proxyName);

const cacheKeys = {
  libraries: `${proxyName}__libraries`,
  recentMovies: `${proxyName}__recent_movies`,
  recentTV: `${proxyName}__recent_tv`,
};

function formatDate(timestampSeconds) {
  const date = new Date(timestampSeconds * 1000);
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function normalizeToArray(v) {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

/**
 * Format a raw Plex Video list into unified recent items.
 * - Uses attrs.thumb (movie) or attrs.grandparentThumb (episode) for cover poster
 * - Keeps raw addedAt (seconds) for reliable sorting
 */
function formatRecentItems(items, { group, service, index }) {
  return items
    .filter((item) => {
      const a = item?._attributes;
      return a?.ratingKey && a?.addedAt && a?.type && a?.title;
    })
    .sort(
      (a, b) =>
        parseInt(b._attributes.addedAt, 10) - parseInt(a._attributes.addedAt, 10),
    )
    .map((item) => {
      const attrs = item._attributes;
      const isEpisode = attrs.type === 'episode';

      // Plex returns thumb/grandparentThumb as attributes, not child Image elements
      const thumbPath = isEpisode
        ? (attrs.grandparentThumb || attrs.thumb)
        : attrs.thumb;

      const coverPoster = thumbPath
        ? `/api/widgets/plexrecent/image?group=${encodeURIComponent(group)}&service=${encodeURIComponent(service)}&index=${encodeURIComponent(index ?? '')}&path=${encodeURIComponent(thumbPath)}`
        : null;

      const addedAt = parseInt(attrs.addedAt, 10);

      return {
        id: attrs.ratingKey,
        title: attrs.title,
        date_added: formatDate(addedAt),
        addedAt,
        year: attrs.year,
        type: attrs.type,
        showTitle: isEpisode ? attrs.grandparentTitle : null,
        episodeNumber: isEpisode ? attrs.index : null,
        seasonNumber: isEpisode ? attrs.parentIndex : null,
        summary: attrs.summary || null,
        grandparentRatingKey: isEpisode ? attrs.grandparentRatingKey : null,
        rating: attrs.rating || null,
        audienceRating: attrs.audienceRating || null,
        duration: attrs.duration ? Math.round(parseInt(attrs.duration, 10) / 60000) : null,
        contentRating: attrs.contentRating ? attrs.contentRating.replace(/^au\//i, '') : null,
        coverPoster,
      };
    });
}

async function getWidget(req) {
  const { group, service, index } = req.query;
  if (!group || !service) return null;
  return await getServiceWidget(group, service, index);
}

async function fetchFromPlexAPI(endpoint, widget, containerSize = '500') {
  const api = widgets?.[widget.type]?.api;
  if (!api) return [403, null];

  const url = new URL(formatApiCall(api, { endpoint, ...widget }));
  const [status, , data] = await httpProxy(url, {
    headers: {
      'X-Plex-Token': widget.key,
      'X-Plex-Container-Start': '0',
      'X-Plex-Container-Size': containerSize,
    },
  });

  if (status !== 200) return [status, null];

  try {
    const json = JSON.parse(xml2json(data.toString(), { compact: true }));
    return [status, json];
  } catch (e) {
    logger.error('Error decoding Plex API response for %s: %s', endpoint, e);
    return [status, null];
  }
}

// Best-effort: a transient failure here shouldn't blank out the whole widget, just the stream count.
async function fetchStreams(widget) {
  const [status, apiData] = await fetchFromPlexAPI('/status/sessions', widget);
  if (status !== 200) {
    logger.warn('Failed to fetch Plex sessions (status=%s); reporting streams=0', status);
    return 0;
  }
  return Number(apiData?.MediaContainer?._attributes?.size) || 0;
}

// Falls back to a stale cached value on transient failure rather than failing the whole request,
// since libraries rarely change and a Plex hiccup shouldn't blank recently-added data either.
async function fetchLibraries(widget, cacheKey) {
  const cached = cache.get(cacheKey);
  const [status, apiData] = await fetchFromPlexAPI('/library/sections', widget);

  if (status !== 200 || !apiData?.MediaContainer?.Directory) {
    if (cached) {
      logger.warn('Failed to refresh Plex libraries (status=%s); serving cached data', status);
      return cached;
    }
    logger.error('Failed to fetch Plex libraries and no cached data available (status=%s)', status);
    return null;
  }

  const items = [].concat(apiData.MediaContainer.Directory);
  const movieTVLibraries = items.filter((l) => ['movie', 'show'].includes(l?._attributes?.type));

  const counts = await Promise.all(
    movieTVLibraries.map(async (lib) => {
      const libKey = lib?._attributes?.key;
      const libType = lib?._attributes?.type;
      if (!libKey) return { libType, total: 0 };
      const [, countData] = await fetchFromPlexAPI(`/library/sections/${libKey}/all`, widget, '0');
      return { libType, total: parseInt(countData?.MediaContainer?._attributes?.totalSize, 10) || 0 };
    }),
  );

  const totalMovies = counts.filter((c) => c.libType === 'movie').reduce((sum, c) => sum + c.total, 0);
  const totalShows = counts.filter((c) => c.libType === 'show').reduce((sum, c) => sum + c.total, 0);

  const libraries = { items, totalMovies, totalShows };
  cache.put(cacheKey, libraries, 1000 * 60 * 60 * 6);
  return libraries;
}

function groupEpisodesByShow(episodes) {
  const grouped = {};

  for (const episode of episodes) {
    const key = episode.grandparentRatingKey;
    if (!key) continue;

    if (!grouped[key]) {
      grouped[key] = {
        id: key,
        showTitle: episode.showTitle,
        poster: episode.coverPoster || null,
        episodes: [],
        latestAdded: 0,
      };
    }

    grouped[key].episodes.push(episode);

    if (episode.addedAt && episode.addedAt > grouped[key].latestAdded) {
      grouped[key].latestAdded = episode.addedAt;
      if (episode.coverPoster) grouped[key].poster = episode.coverPoster;
    }
  }

  Object.values(grouped).forEach((show) => show.episodes.sort((a, b) => b.addedAt - a.addedAt));

  return Object.values(grouped).sort((a, b) => b.latestAdded - a.latestAdded);
}

async function fetchRecent(widget, libraries, { group, service, index }) {
  const movieTVLibraries = libraries.items.filter((l) => ['movie', 'show'].includes(l?._attributes?.type));

  const perLibraryItems = await Promise.all(
    movieTVLibraries.map(async (lib) => {
      const libKey = lib?._attributes?.key;
      if (!libKey) return [];

      const [status, apiData] = await fetchFromPlexAPI(`/library/sections/${libKey}/recentlyAdded`, widget);
      if (status !== 200 || !apiData) return [];

      return normalizeToArray(apiData?.MediaContainer?.Video);
    }),
  );

  const formatted = formatRecentItems(perLibraryItems.flat(), { group, service, index });

  return {
    recentMovies: formatted.filter((i) => i.type === 'movie'),
    recentTV: groupEpisodesByShow(formatted.filter((i) => i.type === 'episode')),
  };
}

export default async function handler(req, res) {
  try {
    const widget = await getWidget(req);
    if (!widget) return res.status(400).json({ error: 'Invalid widget config' });

    const { group, service, index } = req.query;
    const cachePrefix = `${service}.${index}`;

    const streams = await fetchStreams(widget);

    const librariesCacheKey = `${cacheKeys.libraries}.${cachePrefix}`;
    const libraries = await fetchLibraries(widget, librariesCacheKey);
    if (!libraries) {
      return res.status(502).json({ error: { message: 'Unable to fetch Plex libraries' } });
    }

    const recentMoviesCacheKey = `${cacheKeys.recentMovies}.${cachePrefix}`;
    const recentTVCacheKey = `${cacheKeys.recentTV}.${cachePrefix}`;

    let recentMovies = cache.get(recentMoviesCacheKey);
    let recentTV = cache.get(recentTVCacheKey);

    if (!recentMovies || !recentTV) {
      ({ recentMovies, recentTV } = await fetchRecent(widget, libraries, { group, service, index }));

      cache.put(recentMoviesCacheKey, recentMovies, 5 * 60 * 1000);
      cache.put(recentTVCacheKey, recentTV, 5 * 60 * 1000);
    }

    return res.status(200).json({
      streams,
      totalMovies: libraries.totalMovies,
      totalShows: libraries.totalShows,
      recentMovies,
      recentTV,
    });
  } catch (err) {
    logger.error('plexrecent proxy error: %s', err);
    return res.status(500).json({ error: 'plexrecent proxy error', details: String(err) });
  }
}
