// src/pages/Training.jsx
//
// Interactive Training Centre — accessible from the login page without
// signing in. Shows categorised short training videos so new schools
// know exactly how to use SchoolMS before they even sign up.
//
// ─────────────────────────────────────────────────────────────────
// HOW TO ADD YOUR VIDEOS:
//
// For each video, replace the placeholder url with your real embed link:
//
//   YouTube:      https://www.youtube.com/embed/VIDEO_ID
//   Google Drive: https://drive.google.com/file/d/FILE_ID/preview
//   Vimeo:        https://player.vimeo.com/video/VIDEO_ID
//
// To get a YouTube embed URL:
//   1. Open your video on YouTube
//   2. Click Share → Embed
//   3. Copy only the src="..." value from the iframe code
//
// To get a Google Drive embed URL:
//   1. Upload video to Google Drive
//   2. Right-click → Share → change to "Anyone with the link"
//   3. Copy the file ID from the URL (the long string after /d/)
//   4. Use: https://drive.google.com/file/d/FILE_ID/preview
// ─────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { Link } from 'react-router-dom';

// ── YOUR VIDEOS — fill in the url fields ─────────────────────────
const SECTIONS = [
  {
    id:       'getting-started',
    icon:     '🚀',
    title:    'Getting Started',
    color:    '#0F3460',
    desc:     'Everything you need to do before entering your first score.',
    videos: [
      {
        id:       'gs-1',
        title:    'How to Request a Free Trial',
        duration: '2 min',
        desc:     'See how to sign up, what information you need, and what happens after you submit your trial request.',
        url:      'https://drive.google.com/file/d/1FfZiWtIJ7ti0EhH8xKLFZL4IsarZEjh8/preview',
      },
      {
        id:       'gs-2',
        title:    'Setting Up Your School (First Login)',
        duration: '3 min',
        desc:     'After approval, how to set your academic year, term, school logo, grading scale, and report card fields.',
        url:      'https://drive.google.com/file/d/1v74FOFpJEVP4kEsrJU57do3cJgLyojGT/preview',
      },
      {
        id:       'gs-3',
        title:    'Creating Classes and Subjects',
        duration: '2 min',
        desc:     'How to create your school\'s classes and subjects, and link subjects to the right classes.',
        url:      'https://drive.google.com/file/d/1OlK5ssVhJheU2d-Itibrjapc7aS_LaDd/preview',
      },
    ],
  },
  {
    id:       'students',
    icon:     '👥',
    title:    'Managing Students',
    color:    '#2980B9',
    desc:     'Add, import, and enrol your students.',
    videos: [
      {
        id:       'st-1',
        title:    'Adding Students One by One',
        duration: '2 min',
        desc:     'How to use Quick Add to create a student and enrol them in a class in one step.',
        url:      'https://drive.google.com/file/d/1AMeyaAmOUeqZtX-5z-jwYYb1TLrWcSLu/preview',
      },
      {
        id:       'st-2',
        title:    'Importing Students from Excel',
        duration: '3 min',
        desc:     'How to prepare your spreadsheet, upload it, and import hundreds of students at once.',
        url:      'https://drive.google.com/file/d/1PbUpBADJ7BzRevBHqe9dSkVdevhfDqXO/preview',
      },
    ],
  },
  {
    id:       'teachers',
    icon:     '👨‍🏫',
    title:    'Teacher Accounts',
    color:    '#8E44AD',
    desc:     'Create teacher logins and assign their classes and subjects.',
    videos: [
      {
        id:       'tc-1',
        title:    'Creating a Teacher Account',
        duration: '2 min',
        desc:     'How to create a login account for a teacher and set their email and password.',
        url:      'https://www.youtube.com/embed/REPLACE_ME',
      },
      {
        id:       'tc-2',
        title:    'Assigning Classes and Subjects to Teachers',
        duration: '2 min',
        desc:     'How to assign which classes and subjects each teacher can see and enter scores for.',
        url:      'https://www.youtube.com/embed/REPLACE_ME',
      },
    ],
  },
  {
    id:       'scores',
    icon:     '✏️',
    title:    'Entering Scores',
    color:    '#27AE60',
    desc:     'How admins and teachers enter class and exam scores.',
    videos: [
      {
        id:       'sc-1',
        title:    'How to Enter Scores (Admin)',
        duration: '3 min',
        desc:     'Selecting a class, subject, and term, then entering class scores and exam scores for all students.',
        url:      'https://www.youtube.com/embed/REPLACE_ME',
      },
      {
        id:       'sc-2',
        title:    'How Teachers Enter Scores',
        duration: '2 min',
        desc:     'What teachers see when they log in and how they submit scores for their assigned subjects.',
        url:      'https://www.youtube.com/embed/REPLACE_ME',
      },
      {
        id:       'sc-3',
        title:    'Setting Assessment Deadlines',
        duration: '2 min',
        desc:     'How to set opening and closing times for score entry so teachers submit on time.',
        url:      'https://www.youtube.com/embed/REPLACE_ME',
      },
    ],
  },
  {
    id:       'reports',
    icon:     '📄',
    title:    'Generating Report Cards',
    color:    '#E67E22',
    desc:     'Generate results and print professional PDF report cards.',
    videos: [
      {
        id:       'rp-1',
        title:    'Generating Results for a Class',
        duration: '2 min',
        desc:     'How to select a class and term, generate results, and see each student\'s grade and position.',
        url:      'https://www.youtube.com/embed/REPLACE_ME',
      },
      {
        id:       'rp-2',
        title:    'Printing Individual Report Cards',
        duration: '2 min',
        desc:     'How to download a single student\'s PDF report card with school logo, grades, and remarks.',
        url:      'https://www.youtube.com/embed/REPLACE_ME',
      },
      {
        id:       'rp-3',
        title:    'Printing All Report Cards at Once',
        duration: '1 min',
        desc:     'How to print all students\' report cards in one PDF file — ready for distribution on speech day.',
        url:      'https://www.youtube.com/embed/REPLACE_ME',
      },
    ],
  },
  {
    id:       'promotion',
    icon:     '🎓',
    title:    'End-of-Year Promotion',
    color:    '#E94560',
    desc:     'Move students to the next class using the promotion wizard.',
    videos: [
      {
        id:       'pr-1',
        title:    'Running the Promotion Wizard',
        duration: '4 min',
        desc:     'Step-by-step walkthrough of the five-step promotion wizard — from selecting the class to executing promotion.',
        url:      'https://www.youtube.com/embed/REPLACE_ME',
      },
    ],
  },
  {
    id:       'analytics',
    icon:     '📊',
    title:    'Analytics & Performance',
    color:    '#16A085',
    desc:     'View charts showing how your school is performing.',
    videos: [
      {
        id:       'an-1',
        title:    'Using the Analytics Dashboard',
        duration: '3 min',
        desc:     'How to read the grade distribution chart, subject comparison, and student progress graphs.',
        url:      'https://www.youtube.com/embed/REPLACE_ME',
      },
    ],
  },
];

// ── VIDEO PLAYER MODAL ────────────────────────────────────────────
function VideoModal({ video, sectionColor, onClose, onNext, onPrev, hasNext, hasPrev }) {
  const isPlaceholder = !video.url || video.url.includes('REPLACE_ME');

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,.95)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{
              display: 'inline-block', background: sectionColor,
              color: '#fff', fontSize: '.7rem', fontWeight: 700,
              padding: '3px 10px', borderRadius: 20, marginBottom: 6,
              letterSpacing: '.04em',
            }}>
              {video.duration}
            </div>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: '1.05rem', lineHeight: 1.3 }}>
              {video.title}
            </div>
            <div style={{ color: '#90A4AE', fontSize: '.8rem', marginTop: 4, lineHeight: 1.5 }}>
              {video.desc}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,.1)', border: 'none',
              color: '#fff', borderRadius: 8, padding: '8px 14px',
              cursor: 'pointer', fontSize: '.85rem', fontWeight: 700, flexShrink: 0,
            }}
          >
            ✕ Close
          </button>
        </div>

        {/* Video */}
        <div style={{
          width: '100%', aspectRatio: '16/9',
          background: '#0a0a0a', borderRadius: 12,
          overflow: 'hidden', border: '1px solid rgba(255,255,255,.08)',
          position: 'relative',
        }}>
          {isPlaceholder ? (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              color: '#fff', gap: 12, padding: 24,
            }}>
              <div style={{ fontSize: '2.5rem' }}>🎬</div>
              <div style={{ fontWeight: 700, fontSize: '1rem', textAlign: 'center' }}>
                {video.title}
              </div>
              <div style={{
                background: 'rgba(255,255,255,.07)', borderRadius: 10,
                padding: '12px 20px', textAlign: 'center', maxWidth: 480,
              }}>
                <div style={{ color: '#90A4AE', fontSize: '.82rem', lineHeight: 1.7 }}>
                  To add this video, open <code style={{ background: 'rgba(255,255,255,.1)', padding: '1px 6px', borderRadius: 4 }}>src/pages/Training.jsx</code> and replace <code style={{ background: 'rgba(255,255,255,.1)', padding: '1px 6px', borderRadius: 4 }}>REPLACE_ME</code> in the <strong style={{ color: '#fff' }}>{video.id}</strong> entry with your YouTube/Drive embed URL.
                </div>
              </div>
            </div>
          ) : (
            <iframe
              key={video.id}
              src={video.url}
              title={video.title}
              style={{ width: '100%', height: '100%', border: 'none' }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )}
        </div>

        {/* Prev / Next */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={onPrev}
            disabled={!hasPrev}
            style={{
              background: hasPrev ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.03)',
              border: 'none', color: hasPrev ? '#fff' : 'rgba(255,255,255,.2)',
              borderRadius: 8, padding: '10px 18px', cursor: hasPrev ? 'pointer' : 'default',
              fontWeight: 600, fontSize: '.84rem',
            }}
          >
            ← Previous
          </button>
          <button
            onClick={onNext}
            disabled={!hasNext}
            style={{
              background: hasNext ? sectionColor : 'rgba(255,255,255,.03)',
              border: 'none', color: hasNext ? '#fff' : 'rgba(255,255,255,.2)',
              borderRadius: 8, padding: '10px 20px', cursor: hasNext ? 'pointer' : 'default',
              fontWeight: 700, fontSize: '.84rem',
            }}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}

// ── VIDEO CARD ────────────────────────────────────────────────────
function VideoCard({ video, sectionColor, index, onClick, isWatched }) {
  const isPlaceholder = !video.url || video.url.includes('REPLACE_ME');
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', gap: 14, alignItems: 'flex-start',
        width: '100%', background: isWatched ? '#f0faf4' : '#fff',
        border: `1.5px solid ${isWatched ? '#a5d6a7' : '#e8ecf0'}`,
        borderRadius: 12, padding: '14px 16px', cursor: 'pointer',
        textAlign: 'left', transition: 'all .15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = sectionColor; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 4px 16px ${sectionColor}22`; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = isWatched ? '#a5d6a7' : '#e8ecf0'; e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
    >
      {/* Play button */}
      <div style={{
        width: 42, height: 42, borderRadius: 10,
        background: sectionColor,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, position: 'relative',
      }}>
        {isWatched
          ? <span style={{ color: '#fff', fontSize: '1.1rem' }}>✓</span>
          : <span style={{ color: '#fff', fontSize: '1rem', marginLeft: 2 }}>▶</span>
        }
        {isPlaceholder && (
          <div style={{
            position: 'absolute', top: -4, right: -4,
            width: 12, height: 12, borderRadius: '50%',
            background: '#FF9800', border: '2px solid #fff',
          }} />
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: '.88rem', color: '#1a1a2e', lineHeight: 1.3 }}>
            {video.title}
          </span>
          <span style={{
            background: `${sectionColor}18`, color: sectionColor,
            fontSize: '.68rem', fontWeight: 700, padding: '2px 8px',
            borderRadius: 20, flexShrink: 0,
          }}>
            {video.duration}
          </span>
          {isWatched && (
            <span style={{ fontSize: '.68rem', color: '#27AE60', fontWeight: 700 }}>Watched</span>
          )}
        </div>
        <div style={{ fontSize: '.8rem', color: '#666', lineHeight: 1.5 }}>
          {video.desc}
        </div>
      </div>

      <span style={{ color: '#ccc', fontSize: '.9rem', flexShrink: 0, marginTop: 10 }}>›</span>
    </button>
  );
}

// ── SECTION CARD ──────────────────────────────────────────────────
function SectionCard({ section, watchedIds, onVideoClick, activeId }) {
  const watched = section.videos.filter(v => watchedIds.has(v.id)).length;
  const total   = section.videos.length;
  const isActive = activeId === section.id;

  return (
    <div style={{
      background: '#fff', borderRadius: 16,
      border: `2px solid ${isActive ? section.color : '#e8ecf0'}`,
      overflow: 'hidden',
      boxShadow: isActive ? `0 4px 20px ${section.color}22` : '0 2px 8px rgba(0,0,0,.05)',
      transition: 'all .2s',
    }}>
      {/* Section header */}
      <div style={{
        background: isActive ? section.color : '#f8f9fa',
        padding: '16px 20px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{ fontSize: '1.5rem' }}>{section.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: '.95rem', color: isActive ? '#fff' : '#1a1a2e' }}>
            {section.title}
          </div>
          <div style={{ fontSize: '.75rem', color: isActive ? 'rgba(255,255,255,.7)' : '#888', marginTop: 2 }}>
            {section.desc}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: '.75rem', fontWeight: 700, color: isActive ? 'rgba(255,255,255,.9)' : section.color }}>
            {watched}/{total} watched
          </div>
          <div style={{
            width: 60, height: 4, background: isActive ? 'rgba(255,255,255,.3)' : '#e8ecf0',
            borderRadius: 2, marginTop: 4, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: 2,
              background: isActive ? '#fff' : section.color,
              width: `${total > 0 ? (watched / total) * 100 : 0}%`,
              transition: 'width .4s',
            }} />
          </div>
        </div>
      </div>

      {/* Videos */}
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {section.videos.map((video, i) => (
          <VideoCard
            key={video.id}
            video={video}
            sectionColor={section.color}
            index={i}
            isWatched={watchedIds.has(video.id)}
            onClick={() => onVideoClick(section, video)}
          />
        ))}
      </div>
    </div>
  );
}

// ── MAIN TRAINING PAGE ────────────────────────────────────────────
export default function Training() {
  const [activeVideo,   setActiveVideo]   = useState(null);
  const [activeSection, setActiveSection] = useState(null);
  const [watchedIds,    setWatchedIds]    = useState(() => {
    try {
      const saved = localStorage.getItem('schoolms_watched_videos');
      return new Set(saved ? JSON.parse(saved) : []);
    } catch { return new Set(); }
  });
  const [filter, setFilter] = useState('all');

  const totalVideos  = SECTIONS.reduce((n, s) => n + s.videos.length, 0);
  const watchedCount = watchedIds.size;

  // Flat list of all videos for prev/next navigation
  const allVideos = SECTIONS.flatMap(s => s.videos.map(v => ({ ...v, section: s })));

  function openVideo(section, video) {
    setActiveSection(section);
    setActiveVideo(video);
    // Mark as watched
    setWatchedIds(prev => {
      const next = new Set(prev);
      next.add(video.id);
      try { localStorage.setItem('schoolms_watched_videos', JSON.stringify([...next])); } catch {}
      return next;
    });
  }

  function navigate(direction) {
    if (!activeVideo) return;
    const idx  = allVideos.findIndex(v => v.id === activeVideo.id);
    const next = allVideos[idx + direction];
    if (next) openVideo(next.section, next);
  }

  const currentIdx = activeVideo ? allVideos.findIndex(v => v.id === activeVideo.id) : -1;

  const filteredSections = filter === 'all'
    ? SECTIONS
    : filter === 'unwatched'
    ? SECTIONS.filter(s => s.videos.some(v => !watchedIds.has(v.id)))
    : SECTIONS;

  return (
    <>
      {/* Video Modal */}
      {activeVideo && activeSection && (
        <VideoModal
          video={activeVideo}
          sectionColor={activeSection.color}
          onClose={() => { setActiveVideo(null); setActiveSection(null); }}
          onNext={() => navigate(1)}
          onPrev={() => navigate(-1)}
          hasNext={currentIdx < allVideos.length - 1}
          hasPrev={currentIdx > 0}
        />
      )}

      <div style={{ minHeight: '100vh', background: '#f0f4f8' }}>

        {/* ── TOP NAVBAR ── */}
        <div style={{
          background: '#0F3460', color: '#fff',
          padding: '0 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          height: 60, position: 'sticky', top: 0, zIndex: 100,
          boxShadow: '0 2px 12px rgba(0,0,0,.2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link to="/login" style={{ color: 'rgba(255,255,255,.6)', fontSize: '.82rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
              ← Back
            </Link>
            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,.2)' }} />
            <span style={{ fontSize: '1rem' }}>🏫</span>
            <span style={{ fontWeight: 800, fontSize: '.95rem' }}>SchoolMS Training Centre</span>
          </div>
          <Link
            to="/trial"
            style={{
              background: '#E94560', color: '#fff',
              padding: '8px 16px', borderRadius: 8,
              fontWeight: 700, fontSize: '.82rem',
              textDecoration: 'none',
            }}
          >
            Start Free Trial →
          </Link>
        </div>

        {/* ── HERO ── */}
        <div style={{
          background: 'linear-gradient(135deg, #0F3460 0%, #1a4a7a 100%)',
          color: '#fff', padding: '40px 24px 48px', textAlign: 'center',
        }}>
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
            <div style={{ fontSize: '2.2rem', marginBottom: 10 }}>🎓</div>
            <h1 style={{ fontSize: 'clamp(1.4rem, 4vw, 1.9rem)', fontWeight: 900, margin: '0 0 10px' }}>
              Learn SchoolMS in Under 30 Minutes
            </h1>
            <p style={{ opacity: .8, fontSize: '.9rem', lineHeight: 1.7, margin: '0 0 24px' }}>
              Short, practical videos covering every part of the system.
              Watch in order or jump to the topic you need.
            </p>

            {/* Progress */}
            <div style={{
              background: 'rgba(255,255,255,.1)', borderRadius: 14,
              padding: '16px 20px', display: 'inline-flex',
              alignItems: 'center', gap: 20, flexWrap: 'wrap',
              justifyContent: 'center',
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.6rem', fontWeight: 900 }}>{watchedCount}</div>
                <div style={{ fontSize: '.72rem', opacity: .6 }}>watched</div>
              </div>
              <div style={{ width: 120, height: 6, background: 'rgba(255,255,255,.2)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 3,
                  background: '#E94560',
                  width: `${totalVideos > 0 ? (watchedCount / totalVideos) * 100 : 0}%`,
                  transition: 'width .4s',
                }} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.6rem', fontWeight: 900 }}>{totalVideos}</div>
                <div style={{ fontSize: '.72rem', opacity: .6 }}>total videos</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── CONTENT ── */}
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '28px 16px 60px' }}>

          {/* Filter */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '.8rem', color: '#888', fontWeight: 600 }}>Show:</span>
            {[['all', 'All Videos'], ['unwatched', 'Not Watched Yet']].map(([val, label]) => (
              <button
                key={val}
                onClick={() => setFilter(val)}
                style={{
                  padding: '6px 14px', borderRadius: 20, fontSize: '.8rem',
                  border: `1.5px solid ${filter === val ? '#0F3460' : '#ddd'}`,
                  background: filter === val ? '#0F3460' : '#fff',
                  color: filter === val ? '#fff' : '#666',
                  cursor: 'pointer', fontWeight: filter === val ? 700 : 400,
                }}
              >
                {label}
              </button>
            ))}
            {watchedCount > 0 && (
              <button
                onClick={() => {
                  if (window.confirm('Reset your watch progress?')) {
                    setWatchedIds(new Set());
                    try { localStorage.removeItem('schoolms_watched_videos'); } catch {}
                  }
                }}
                style={{ padding: '6px 14px', borderRadius: 20, fontSize: '.78rem', border: '1.5px solid #ddd', background: '#fff', color: '#999', cursor: 'pointer', marginLeft: 'auto' }}
              >
                Reset progress
              </button>
            )}
          </div>

          {/* Sections */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {filteredSections.map(section => (
              <SectionCard
                key={section.id}
                section={section}
                watchedIds={watchedIds}
                onVideoClick={openVideo}
                activeId={activeSection?.id}
              />
            ))}
          </div>

          {/* Bottom CTA */}
          <div style={{
            marginTop: 40, background: 'linear-gradient(135deg, #0F3460, #1a4a7a)',
            borderRadius: 16, padding: '28px 24px', textAlign: 'center', color: '#fff',
          }}>
            <div style={{ fontSize: '1.5rem', marginBottom: 10 }}>🎁</div>
            <div style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: 6 }}>Ready to get started?</div>
            <div style={{ opacity: .75, fontSize: '.88rem', marginBottom: 20, lineHeight: 1.6 }}>
              Your first 21 days are completely free. No payment needed.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link
                to="/trial"
                style={{
                  background: '#E94560', color: '#fff',
                  padding: '12px 28px', borderRadius: 10,
                  fontWeight: 800, fontSize: '.95rem', textDecoration: 'none',
                }}
              >
                Start Free Trial
              </Link>
              <Link
                to="/login"
                style={{
                  background: 'rgba(255,255,255,.12)',
                  border: '1px solid rgba(255,255,255,.2)',
                  color: '#fff', padding: '12px 24px', borderRadius: 10,
                  fontWeight: 600, fontSize: '.95rem', textDecoration: 'none',
                }}
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
