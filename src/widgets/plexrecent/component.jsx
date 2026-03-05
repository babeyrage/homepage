import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { useTranslation } from 'next-i18next';
import Container from 'components/services/widget/container';
import Block from 'components/services/widget/block';

import {
  CriticsFresh,
  CriticsRotten,
  AudienceFresh,
  AudienceRotten,
} from './ratingIcons';

import useWidgetAPI from 'utils/proxy/use-widget-api';

// Shared heading style used across all section/row headings
const headingCls = 'text-xs font-bold uppercase tracking-wide text-theme-700 dark:text-theme-200';
// Muted label style for popup metadata keys
const labelCls = 'text-xs text-theme-700 dark:text-theme-200 opacity-60';
// Body text style for popup content
const bodyCls = 'text-xs text-theme-700 dark:text-theme-300';

export default function Component({ service }) {
  const { t } = useTranslation();
  const { widget } = service;
  const { data: plexData, error } = useWidgetAPI(widget, 'unified', {
    refreshInterval: 5000,
  });

  if (error) return <Container service={service} error={error} />;
  if (!plexData) return (
    <Container service={service}>
      <div className="flex flex-col w-full">
        <div className="flex flex-row w-full">
          <Block label="plex.movies" />
          <Block label="plex.tv" />
        </div>
      </div>
    </Container>
  );

  return (
    <Container service={service}>
      <div className="flex flex-col w-full">
        <div className="flex flex-row w-full">
          <Block label="plex.movies" value={t('common.number', { value: plexData.totalMovies })} />
          <Block label="plex.tv" value={t('common.number', { value: plexData.totalShows })} />
        </div>
        <div className="w-full px-4 pt-3 pb-4 space-y-4">
          <h2 className={headingCls}>
            {t('plex.recentlyAdded', 'Recently Added')}
          </h2>
          <div className="space-y-4">
            <RecentRow title={t('plex.recentMovies', 'Movies')} items={plexData.recentMovies} type="movie" />
            <RecentTVRow title={t('plex.recentTV', 'TV Shows')} items={plexData.recentTV} />
          </div>
        </div>
      </div>
    </Container>
  );
}

function RecentRow({ title, items = [], type }) {
  const scrollRef = useRef(null);

  const scroll = (direction) => {
    if (scrollRef.current) {
      const amount = direction === 'left' ? -300 : 300;
      scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  return (
    <div>
      <h3 className={`${headingCls} mb-2`}>{title}</h3>
      <div className="relative group">
        <button
          onClick={() => scroll('left')}
          className="hidden group-hover:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 text-white px-2 py-1 rounded-full shadow-md"
        >
          ‹
        </button>
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto scroll-smooth scrollbar-thin scrollbar-thumb-theme-600/30 pb-1 pr-2"
        >
          {items.map((item, i) => (
            <RecentItem key={item.id} item={item} type={type} priority={i === 0} />
          ))}
        </div>
        <button
          onClick={() => scroll('right')}
          className="hidden group-hover:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 text-white px-2 py-1 rounded-full shadow-md"
        >
          ›
        </button>
      </div>
    </div>
  );
}

function RecentItem({ item, type, priority = false }) {
  const [show, setShow] = useState(false);
  const [clickPosition, setClickPosition] = useState({ x: 0, y: 0 });
  const ref = useRef();
  const poster = type === 'tv' ? item.poster : item.coverPoster || '/no-thumb.png';

  const [imgSrc, setImgSrc] = useState(poster || '/no-thumb.png');

  const handleClick = (e) => {
    e.stopPropagation();
    setClickPosition({ x: e.clientX, y: e.clientY });
    setShow(true);
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setShow(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const criticRating = parseFloat(item.rating || 0);
  const audienceRating = parseFloat(item.audienceRating || 0);

  const CriticsIcon = criticRating >= 6.5 ? CriticsFresh : CriticsRotten;
  const AudienceIcon = audienceRating >= 6.5 ? AudienceFresh : AudienceRotten;

  return (
    <>
      <div
        ref={ref}
        onClick={handleClick}
        className="relative w-25 min-w-25 shrink-0 cursor-pointer mb-1 hover:scale-[1.03] transition-transform duration-200 ease-out"
      >
        <Image
          src={imgSrc || '/no-thumb.png'}
          alt={item.title || item.showTitle || 'Poster'}
          width={100}
          height={150}
          className="rounded shadow object-cover w-full h-37.5"
          priority={priority}
          loading={priority ? undefined : 'lazy'}
          referrerPolicy="no-referrer"
          onError={() => setImgSrc('/no-thumb.png')}
        />
        {type === 'tv' && item.episodes?.length > 1 && (
          <div className="absolute top-0 right-0 bg-black/80 text-white text-xs font-semibold w-5 h-5 flex items-center justify-center rounded-sm shadow-md border border-white/10">
            {item.episodes.length}
          </div>
        )}
      </div>

      {show &&
        createPortal(
          <div
            ref={ref}
            className="fixed z-9999 w-[90vw] max-w-85 bg-[#1e1e2f] text-gray-100 p-4 rounded-lg border border-gray-700 shadow-2xl animate-fade-in overflow-y-auto max-h-[calc(100vh-100px)]"
            style={{
              top: Math.min(clickPosition.y + 10, window.innerHeight - 360),
              left: Math.min(clickPosition.x + 10, window.innerWidth - 380),
            }}
          >
            <div className="text-sm font-semibold mb-3 leading-tight">
              {type === 'movie'
                ? `${item.title} (${item.year})`
                : item.showTitle || item.title}
            </div>

            <div className="space-y-2">
              {type === 'movie' && (
                <>
                  <div className="grid grid-cols-3 gap-y-2 mb-2">
                    <div>
                      <div className={labelCls}>Year</div>
                      <div className={bodyCls}>{item.year}</div>
                    </div>
                    <div>
                      <div className={labelCls}>Length</div>
                      <div className={bodyCls}>{item.duration ? `${item.duration} min` : '—'}</div>
                    </div>
                    <div>
                      <div className={labelCls}>Rated</div>
                      <div className={bodyCls}>{item.contentRating || '—'}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <CriticsIcon />
                      <span className={bodyCls}>{Math.round(criticRating * 10)}%</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <AudienceIcon />
                      <span className={bodyCls}>{Math.round(audienceRating * 10)}%</span>
                    </div>
                  </div>

                  {item.summary && (
                    <p className={`${bodyCls} whitespace-pre-line`}>{item.summary}</p>
                  )}
                  <div className={bodyCls}>
                    <span className={labelCls}>Added:</span> {item.date_added}
                  </div>
                </>
              )}

              {type === 'tv' && (
                <div className="space-y-2">
                  <div className={bodyCls}>
                    <span className={labelCls}>Episodes:</span> {item.episodes?.length}
                  </div>
                  <div className="max-h-55 overflow-y-auto pr-1 space-y-2">
                    {item.episodes?.map((ep, index) => (
                      <ExpandableEpisodeRow key={ep.id} ep={ep} index={index} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

function ExpandableEpisodeRow({ ep, index }) {
  const [expanded, setExpanded] = useState(false);
  const audienceRating = parseFloat(ep.audienceRating || 0);
  const AudienceIcon = audienceRating >= 6.5 ? AudienceFresh : AudienceRotten;

  const handleEpisodeClick = (e) => {
    e.stopPropagation();
    setExpanded((prev) => !prev);
  };

  return (
    <div
      onClick={handleEpisodeClick}
      className={`cursor-pointer border-b border-gray-700 pb-1 px-1 rounded-sm ${
        index % 2 === 0 ? 'bg-gray-800/30' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-gray-100 whitespace-nowrap">
          S{ep.seasonNumber}E{ep.episodeNumber}
        </span>
        <span className="text-xs text-gray-300 font-normal truncate flex-1">
          {ep.title}
        </span>
      </div>
      <div className="text-xs text-gray-400 mt-0.5">
        Added: {ep.date_added}
      </div>
      {expanded && (
        <>
          {ep.audienceRating && (
            <div className="flex items-center gap-1 text-xs text-gray-300 mt-1">
              <AudienceIcon />
              <span>{Math.round(audienceRating * 10)}%</span>
            </div>
          )}
          {ep.summary && (
            <div className="mt-1 text-xs text-gray-300 whitespace-pre-line">
              {ep.summary}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function RecentTVRow({ title, items = [] }) {
  return <RecentRow title={title} items={items} type="tv" />;
}
