'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bot,
  Zap,
  LayoutDashboard,
  CreditCard,
  ShieldCheck,
  Lock,
} from 'lucide-react';

interface AppShellProps {
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { label: 'Overview', href: '/', icon: LayoutDashboard },
  { label: 'Payments', href: '/payments', icon: CreditCard },
  { label: 'Recovery', href: '/recovery', icon: Zap },
  { label: 'Audit', href: '/audit', icon: ShieldCheck },
] as const;

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--canvas)', display: 'flex', flexDirection: 'column' }}>
      {/* ── Top Application Header ── */}
      <header
        style={{
          background: 'var(--paper)',
          borderBottom: '1px solid var(--border)',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: '0 auto',
            padding: '0 24px',
          }}
        >
          {/* Brand + Status Row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              height: 44,
              borderBottom: '1px solid var(--border)',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            {/* Brand */}
            <Link
              href="/"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <div
                className="fold-corner fold-corner-canvas"
                style={{
                  width: 28,
                  height: 28,
                  background: 'var(--ink)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-editorial)',
                    fontSize: 15,
                    fontWeight: 600,
                    color: 'var(--canvas)',
                    lineHeight: 1,
                  }}
                >
                  R
                </span>
              </div>
              <span
                style={{
                  fontFamily: 'var(--font-editorial)',
                  fontSize: 16,
                  fontWeight: 600,
                  color: 'var(--ink)',
                  letterSpacing: '-0.02em',
                }}
              >
                Recover<span style={{ color: 'var(--accent-clay)' }}>AI</span>
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 11,
                  color: 'var(--ink-muted)',
                  paddingLeft: 10,
                  borderLeft: '1px solid var(--border)',
                  marginLeft: 4,
                }}
              >
                Operations Console
              </span>
            </Link>

            {/* System Status Chips */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: 'var(--accent-lavender)',
                  background: 'var(--accent-lavender-light)',
                  borderLeft: '2px solid var(--accent-lavender)',
                  borderRadius: 'var(--radius-subtle)',
                  padding: '2px 8px',
                }}
                title="AI diagnostic brain provider"
              >
                <Bot style={{ width: 10, height: 10 }} />
                AI: MOCK
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: 'var(--accent-sage)',
                  background: 'var(--accent-sage-light)',
                  borderLeft: '2px solid var(--accent-sage)',
                  borderRadius: 'var(--radius-subtle)',
                  padding: '2px 8px',
                }}
                title="Execution mode: zero live money movement"
              >
                <Zap style={{ width: 10, height: 10 }} />
                MODE: TEST
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: 'var(--accent-sage)',
                  background: 'var(--accent-sage-light)',
                  borderLeft: '2px solid var(--accent-sage)',
                  borderRadius: 'var(--radius-subtle)',
                  padding: '2px 8px',
                }}
                title="Deterministic safety policies active"
              >
                <ShieldCheck style={{ width: 10, height: 10 }} />
                POLICY: ENFORCED
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: 'var(--accent-lavender)',
                  background: 'var(--accent-lavender-light)',
                  borderLeft: '2px solid var(--accent-lavender)',
                  borderRadius: 'var(--radius-subtle)',
                  padding: '2px 8px',
                }}
                title="Idempotency gate active: prevents double-recovery"
              >
                <Lock style={{ width: 10, height: 10 }} />
                IDEMPOTENT
              </span>
            </div>
          </div>

          {/* Nav Row */}
          <nav
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 4,
              height: 40,
              overflowX: 'auto',
            }}
            aria-label="Main navigation"
          >
            {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    height: '100%',
                    padding: '0 16px',
                    fontFamily: 'var(--font-sans)',
                    fontSize: 13,
                    fontWeight: active ? 600 : 400,
                    color: active ? 'var(--ink)' : 'var(--ink-muted)',
                    textDecoration: 'none',
                    borderBottom: active ? '2px solid var(--accent-clay)' : '2px solid transparent',
                    transition: 'color 0.12s, border-color 0.12s',
                    letterSpacing: '-0.01em',
                    position: 'relative',
                    top: 1,
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => {
                    if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--ink)';
                  }}
                  onMouseLeave={(e) => {
                    if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--ink-muted)';
                  }}
                >
                  <Icon
                    style={{
                      width: 13,
                      height: 13,
                      color: active ? 'var(--accent-clay)' : 'var(--ink-muted)',
                    }}
                  />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* ── Page Content ── */}
      <main style={{ flex: 1 }}>
        {children}
      </main>

      {/* ── Footer ── */}
      <footer
        style={{
          borderTop: '1px solid var(--border)',
          background: 'var(--paper)',
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: '0 auto',
            padding: '12px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 11,
              color: 'var(--ink-muted)',
            }}
          >
            <span style={{ fontFamily: 'var(--font-editorial)', fontWeight: 600, color: 'var(--ink)', fontSize: 13 }}>
              RecoverAI
            </span>{' '}
            · AI Revenue Recovery Operations Console · Track 03 Phase 7
          </span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--ink-faint)',
            }}
          >
            <span>Deterministic Seed: #4242</span>
            <span>Policy Supremacy Enforced</span>
            <span>Local Offline SQLite</span>
            <span>INR Currency</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
