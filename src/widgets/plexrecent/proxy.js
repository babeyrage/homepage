/* eslint-disable no-underscore-dangle */
import cache from 'memory-cache';
import { xml2json } from 'xml-js';

import { formatApiCall } from 'utils/proxy/api-helpers';
import { httpProxy } from 'utils/proxy/http';
import getServiceWidget from 'utils/config/service-helpers';
import createLogger from 'utils/logger';
import widgets from 'widgets/widgets';

const proxyName = 'plexProxyHandler';
const logger = createLogger(proxyName);

const cacheKeys = {
  libraries: `${proxyName}__libraries`,
  albums: `${proxyName}__albums`,
  movies: `${proxyName}__movies`,
  tv: `${proxyName}__tv`,
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
 * - Keeps raw addedAt (seconds) for reliable sorting
 * - Emits pretty date_added for UI
 * - Resolves coverPoster to a fully-qualified PMS URL with token
 */
function formatRecentItems(items, widget) {
  return items
    .filter((item) => {
      const a = item?._attributes;
      return a?.ratingKey && a?.addedAt && a?.type && a?.title;
    })
    // Sort using raw addedAt timestamp (desc)
    .sort(
      (a, b) =>
        parseInt(b._attributes.addedAt, 10) - parseInt(a._attributes.addedAt, 10)
    )
    .map((item) => {
      const attrs = item._attributes;
      const isEpisode = attrs.type === 'episode';

      const images = normalizeToArray(item.Image);
      const coverPosterAttr = images.find(
        (img) => img._attributes?.type === 'coverPoster'
      )?._attributes?.url;

      const coverPoster = coverPosterAttr
        ? `${widget.url}${coverPosterAttr}?X-Plex-Token=${widget.key}`
        : null;

      const addedAt = parseInt(attrs.addedAt, 10);

      return {
        id: attrs.ratingKey,
        title: attrs.title,
        date_added: formatDate(addedAt),
        addedAt, // <-- raw timestamp for sorting
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

async function fetchFromPlexAPI(endpoint, widget) {
  const api = widgets?.[widget.type]?.api;
  if (!api) return [403, null];

  const url = new URL(formatApiCall(api, { endpoint, ...widget }));
  const [status, , data] = await httpProxy(url);
  if (status !== 200) return [status, null];

  const json = JSON.parse(xml2json(data.toString(), { compact: true }));
  return [status, json];
}

export default async function handler(req, res) {
  try {
    const widget = await getWidget(req);
    if (!widget) return res.status(400).json({ error: 'Invalid widget config' });

    // -----------------------------
    // Streams
    // -----------------------------
    logger.debug('Getting streams from Plex API');
    let streams = 0;

    let [status, apiData] = await fetchFromPlexAPI('/status/sessions', widget);

    if (status !== 200) {
      return res.status(status).json({
        error: {
          message: 'HTTP error communicating with Plex API',
          data: apiData ? Buffer.from(apiData).toString() : null,
        },
      });
    }

    if (apiData?.MediaContainer?._attributes?.size != null) {
      streams = Number(apiData.MediaContainer._attributes.size) || 0;
    }

    // -----------------------------
    // Libraries (6h cache)
    // -----------------------------
    const librariesCacheKey = `${cacheKeys.libraries}.${widget.service}`;
    let libraries = cache.get(librariesCacheKey);

    if (!libraries) {
      logger.debug('Getting libraries from Plex API');
      [status, apiData] = await fetchFromPlexAPI('/library/sections', widget);

      if (status !== 200) {
        return res.status(status).json({
          error: {
            message: 'HTTP error communicating with Plex API',
            data: apiData ? Buffer.from(apiData).toString() : null,
          },
        });
      }

      if (apiData?.MediaContainer?.Directory) {
        libraries = [].concat(apiData.MediaContainer.Directory);
        cache.put(librariesCacheKey, libraries, 1000 * 60 * 60 * 6);
      } else {
        libraries = [];
      }
    }

    // -----------------------------
    // Recent (5m cache)
    // -----------------------------
    const recentMoviesCacheKey = `${cacheKeys.recentMovies}.${widget.service}`;
    const recentTVCacheKey = `${cacheKeys.recentTV}.${widget.service}`;

    let recentMovies = cache.get(recentMoviesCacheKey);
    let recentTV = cache.get(recentTVCacheKey);

    if (!recentMovies || !recentTV) {
      recentMovies = [];
      recentTV = [];

      const movieTVLibraries = libraries.filter((l) =>
        ['movie', 'show'].includes(l?._attributes?.type)
      );

      let items = [];

      for (const lib of movieTVLibraries) {
        const libKey = lib?._attributes?.key;
        if (!libKey) continue;

        const endpoint = `/library/sections/${libKey}/recentlyAdded`;
        [status, apiData] = await fetchFromPlexAPI(endpoint, widget);

        // If one library fails, skip it rather than killing the whole response
        if (status !== 200) continue;

        const videos = normalizeToArray(apiData?.MediaContainer?.Video);
        items = items.concat(videos);
      }

      const formatted = formatRecentItems(items, widget);

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

      cache.put(recentMoviesCacheKey, recentMovies, 5 * 60 * 1000);
      cache.put(recentTVCacheKey, recentTV, 5 * 60 * 1000);
    }

    // -----------------------------
    // Response
    // -----------------------------
    return res.status(200).json({
      streams,
      albums: 0,
      movies: 0,
      tv: 0,
      recentMovies,
      recentTV,
    });
  } catch (err) {
    logger.error('Plex proxy error:', err);
    return res.status(500).json({ error: 'Plex proxy error', details: String(err) });
  }
}