'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { useTranslation } from 'next-i18next';
import Container from 'components/services/widget/container';

import {
  CriticsFresh,
  CriticsRotten,
  AudienceFresh,
  AudienceRotten,
} from './ratingIcons';

import useWidgetAPI from 'utils/proxy/use-widget-api';

export default function Component({ service }) {
  const { t } = useTranslation();
  const { widget } = service;
  const { data: plexData, error } = useWidgetAPI(widget, 'unified', {
    refreshInterval: 5000,
  });

  if (error || !plexData) {
    return <Container service={service} error={error || !plexData} />;
  }

  return (
    <Container service={service}>
      <div className="w-full px-4 py-4 space-y-6">
        <RecentRow
          title={t('plex.recentMovies', 'Movies')}
          items={plexData.recentMovies}
          type="movie"
        />
        <RecentTVRow
          title={t('plex.recentTV', 'TV Shows')}
          items={plexData.recentTV}
        />
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
      <h2 className="text-sm font-bold mb-2 text-theme-700 dark:text-theme-200">
        {title}
      </h2>
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
          {items.map((item) => (
            <RecentItem key={item.id} item={item} type={type} />
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

function RecentItem({ item, type }) {
  const [show, setShow] = useState(false);
  const [clickPosition, setClickPosition] = useState({ x: 0, y: 0 });
  const ref = useRef();
  const poster = type === 'tv' ? item.poster : item.coverPoster || '/no-thumb.png';

  // For next/image fallback handling
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
        className="relative w-[100px] min-w-[100px] flex-shrink-0 cursor-pointer mb-1 hover:scale-[1.03] transition-transform duration-200 ease-out"
      >
        <Image
          src={imgSrc || '/no-thumb.png'}
          alt={item.title || item.showTitle || 'Poster'}
          width={100}
          height={150}
          className="rounded shadow object-cover w-full h-[150px]"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImgSrc('/no-thumb.png')}
        />
        {type === 'tv' && item.episodes?.length > 1 && (
          <div className="absolute top-0 right-0 bg-black/80 text-white text-[10px] font-semibold w-5 h-5 flex items-center justify-center rounded-sm shadow-md border border-white/10">
            {item.episodes.length}
          </div>
        )}
      </div>

      {show &&
        createPortal(
          <div
            ref={ref}
            className="fixed z-[9999] w-[90vw] max-w-[340px] bg-[#1e1e2f] text-gray-100 p-4 rounded-lg border border-gray-700 shadow-2xl text-xs animate-fade-in overflow-y-auto max-h-[calc(100vh-100px)]"
            style={{
              top: Math.min(clickPosition.y + 10, window.innerHeight - 360),
              left: Math.min(clickPosition.x + 10, window.innerWidth - 380),
            }}
          >
            <div className="font-semibold mb-3 leading-tight">
              {type === 'movie'
                ? `${item.title} (${item.year})`
                : item.showTitle || item.title}
            </div>

            <div className="space-y-2 leading-snug">
              {type === 'movie' && (
                <>
                  <div className="grid grid-cols-3 text-[11px] text-gray-300 mb-2 gap-y-1">
                    <div>
                      <span className="opacity-70">Year</span>
                      <br />
                      {item.year}
                    </div>
                    <div>
                      <span className="opacity-70">Length</span>
                      <br />
                      {item.duration ? `${item.duration} min` : '—'}
                    </div>
                    <div>
                      <span className="opacity-70">Rated</span>
                      <br />
                      {item.contentRating || '—'}
                    </div>
                    <div className="flex items-center gap-1 pt-1 pb-1 col-span-1">
                      <CriticsIcon />
                      <span>{Math.round(criticRating * 10)}%</span>
                    </div>
                    <div className="flex items-center gap-1 col-span-1">
                      <AudienceIcon />
                      <span>{Math.round(audienceRating * 10)}%</span>
                    </div>
                  </div>

                  {item.summary && (
                    <p className="text-gray-300 mb-2 text-xs whitespace-pre-line">
                      {item.summary}
                    </p>
                  )}
                  <div className="text-[11px] text-gray-400">
                    <span className="opacity-70">Added:</span> {item.date_added}
                  </div>
                </>
              )}

              {type === 'tv' && (
                <div className="space-y-2">
                  <div className="text-[11px] text-gray-400">
                    <span className="opacity-70">Episodes:</span>{' '}
                    {item.episodes?.length}
                  </div>

                  <div className="max-h-[220px] overflow-y-auto pr-1 space-y-2">
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
      <div className="text-white text-[12px] font-medium flex items-center justify-between gap-2">
        <span className="whitespace-nowrap text-[12px] font-semibold text-gray-100">
          S{ep.seasonNumber}E{ep.episodeNumber}
        </span>
        <span className="truncate text-gray-300 text-[12px] font-normal flex-1">
          {ep.title}
        </span>
      </div>
      <div className="text-gray-400 text-[11px] mt-0.5">
        Added: {ep.date_added}
      </div>
      {expanded && (
        <>
          {ep.audienceRating && (
            <div className="flex items-center gap-1 text-[11px] text-theme-200 mt-1">
              <AudienceIcon />
              <span>{Math.round(audienceRating * 10)}%</span>
            </div>
          )}
          {ep.summary && (
            <div className="mt-1 text-gray-300 text-[11px] whitespace-pre-line">
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
