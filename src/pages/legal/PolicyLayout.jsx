import React from 'react';
import { Link } from 'react-router-dom';

export default function PolicyLayout({ title, lastUpdated, children }) {
  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa', padding: '32px 16px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ background: '#0f3460', borderRadius: 16, padding: '32px 40px', marginBottom: 24, color: '#fff' }}>
          <Link to="/login" style={{ color: 'rgba(255,255,255,.7)', fontSize: '.8rem', textDecoration: 'none', display: 'inline-block', marginBottom: 16 }}>
            ← Back to login
          </Link>
          <h1 style={{ margin: 0, fontSize: '1.6rem' }}>{title}</h1>
          <div style={{ marginTop: 6, fontSize: '.8rem', opacity: .7 }}>Last updated: {lastUpdated}</div>
        </div>

        {/* Content */}
        <div style={{
          background: '#fff', borderRadius: 16, padding: '40px',
          lineHeight: 1.8, fontSize: '.9rem', color: '#333',
        }}>
          <style>{`
            section { margin-bottom: 28px; }
            section h2 { color: #0f3460; font-size: 1.05rem; margin-bottom: 10px; border-bottom: 2px solid #e3f2fd; padding-bottom: 6px; }
            section p { margin-bottom: 10px; }
            section ul, section ol { padding-left: 22px; margin-bottom: 10px; }
            section li { margin-bottom: 6px; }
            section a { color: #0f3460; }
            section table th, section table td { border: 1px solid #e0e0e0; }
          `}</style>
          {children}
        </div>

        {/* Footer links */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginTop: 24, fontSize: '.8rem' }}>
          {[
            ['/legal/privacy', 'Privacy Policy'],
            ['/legal/terms', 'Terms of Service'],
            ['/legal/subscription', 'Subscription Policy'],
            ['/legal/data-retention', 'Data Retention'],
            ['/legal/data-security', 'Data Security'],
          ].map(([to, label]) => (
            <Link key={to} to={to} style={{ color: '#0f3460', textDecoration: 'none', opacity: .8 }}>{label}</Link>
          ))}
        </div>
      </div>
    </div>
  );
}
