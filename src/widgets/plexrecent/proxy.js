/* eslint-disable no-underscore-dangle */
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

export default async function handler(req, res) {
  try {
    const widget = await getWidget(req);
    if (!widget) return res.status(400).json({ error: 'Invalid widget config' });

    logger.debug('[DEBUG] widget.type=%s widget.url=%s widget.key=%s', widget.type, widget.url, widget.key ? '(set)' : '(MISSING)');

    const { group, service, index } = req.query;
    const cachePrefix = `${service}.${index}`;

    // -----------------------------
    // Streams
    // -----------------------------
    let streams = 0;
    let [status, apiData] = await fetchFromPlexAPI('/status/sessions', widget);

    logger.debug('[DEBUG] /status/sessions → status=%d apiData keys=%s', status, apiData ? Object.keys(apiData).join(',') : 'null');

    if (status !== 200) {
      return res.status(status).json({
        error: { message: 'HTTP error communicating with Plex API' },
      });
    }

    if (apiData?.MediaContainer?._attributes?.size != null) {
      streams = Number(apiData.MediaContainer._attributes.size) || 0;
    }

    // -----------------------------
    // Libraries (6h cache)
    // -----------------------------
    const librariesCacheKey = `${cacheKeys.libraries}.${cachePrefix}`;
    let libraries = cache.get(librariesCacheKey);

    if (!libraries || Array.isArray(libraries)) {
      logger.debug('[DEBUG] cache miss for libraries, fetching from Plex');
      [status, apiData] = await fetchFromPlexAPI('/library/sections', widget);

      logger.debug('[DEBUG] /library/sections → status=%d hasMediaContainer=%s', status, !!apiData?.MediaContainer);
      logger.debug('[DEBUG] /library/sections raw keys=%s', apiData ? JSON.stringify(Object.keys(apiData?.MediaContainer ?? {})) : 'null');

      if (status !== 200 || !apiData) {
        return res.status(status ?? 500).json({
          error: { message: 'HTTP error fetching Plex libraries' },
        });
      }

      if (apiData?.MediaContainer?.Directory) {
        libraries = [].concat(apiData.MediaContainer.Directory);
        const libSummary = libraries.map((l) => `${l?._attributes?.key}:${l?._attributes?.type}:${l?._attributes?.title}`);
        logger.debug('[DEBUG] libraries found: %s', JSON.stringify(libSummary));

        // Fetch total counts for movie/show libraries
        let totalMovies = 0;
        let totalShows = 0;
        for (const lib of libraries) {
          const libKey = lib?._attributes?.key;
          const libType = lib?._attributes?.type;
          if (!libKey || !['movie', 'show'].includes(libType)) continue;
          const [, countData] = await fetchFromPlexAPI(`/library/sections/${libKey}/all`, widget, '0');
          const total = parseInt(countData?.MediaContainer?._attributes?.totalSize, 10) || 0;
          if (libType === 'movie') totalMovies += total;
          else if (libType === 'show') totalShows += total;
        }

        libraries = { items: libraries, totalMovies, totalShows };
        cache.put(librariesCacheKey, libraries, 1000 * 60 * 60 * 6);
      } else {
        logger.debug('[DEBUG] no Directory in MediaContainer — full apiData: %s', JSON.stringify(apiData).slice(0, 500));
        libraries = { items: [], totalMovies: 0, totalShows: 0 };
      }
    } else {
      logger.debug('[DEBUG] libraries cache hit, count=%d', libraries.items.length);
    }

    // -----------------------------
    // Recent (5m cache)
    // -----------------------------
    const recentMoviesCacheKey = `${cacheKeys.recentMovies}.${cachePrefix}`;
    const recentTVCacheKey = `${cacheKeys.recentTV}.${cachePrefix}`;

    let recentMovies = cache.get(recentMoviesCacheKey);
    let recentTV = cache.get(recentTVCacheKey);

    if (!recentMovies || !recentTV) {
      recentMovies = [];
      recentTV = [];

      const movieTVLibraries = libraries.items.filter((l) =>
        ['movie', 'show'].includes(l?._attributes?.type),
      );

      logger.debug('[DEBUG] movieTVLibraries count=%d (of %d total)', movieTVLibraries.length, libraries.items.length);

      let items = [];

      for (const lib of movieTVLibraries) {
        const libKey = lib?._attributes?.key;
        const libType = lib?._attributes?.type;
        if (!libKey) continue;

        const endpoint = `/library/sections/${libKey}/recentlyAdded`;
        [status, apiData] = await fetchFromPlexAPI(endpoint, widget);

        const videoCount = normalizeToArray(apiData?.MediaContainer?.Video).length;
        const containerKeys = apiData?.MediaContainer ? Object.keys(apiData.MediaContainer).join(',') : 'null';
        logger.debug('[DEBUG] %s (type=%s) → status=%d videoCount=%d containerKeys=%s', endpoint, libType, status, videoCount, containerKeys);

        if (status !== 200 || !apiData) continue;

        const videos = normalizeToArray(apiData?.MediaContainer?.Video);
        items = items.concat(videos);
      }

      logger.debug('[DEBUG] total raw items fetched: %d', items.length);

      const formatted = formatRecentItems(items, { group, service, index });
      logger.debug('[DEBUG] formatted items: %d (movies=%d, episodes=%d)', formatted.length,
        formatted.filter(i => i.type === 'movie').length,
        formatted.filter(i => i.type === 'episode').length,
      );

      // Movies
      recentMovies = formatted.filter((i) => i.type === 'movie');

      // Episodes grouped by show
      const episodes = formatted.filter((i) => i.type === 'episode');
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

      for (const key in grouped) {
        grouped[key].episodes.sort((a, b) => b.addedAt - a.addedAt);
      }

      recentTV = Object.values(grouped).sort((a, b) => b.latestAdded - a.latestAdded);

      logger.debug('[DEBUG] recentMovies=%d recentTV shows=%d', recentMovies.length, recentTV.length);

      cache.put(recentMoviesCacheKey, recentMovies, 5 * 60 * 1000);
      cache.put(recentTVCacheKey, recentTV, 5 * 60 * 1000);
    } else {
      logger.debug('[DEBUG] recent cache hit — recentMovies=%d recentTV=%d', recentMovies.length, recentTV.length);
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
