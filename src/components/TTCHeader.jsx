import ThemeToggle from './ThemeToggle';

/**
 * TTC Standard Header
 *
 * The header that goes on top of every TTC app.
 * - TTC blue band with the official logo on the left
 * - App name next to the logo with a | divider
 * - Right side: slots for user info, nav links, theme toggle, sign out
 *
 * Usage:
 *   import TTCHeader from './components/TTCHeader';
 *   import ttcLogo from './assets/ttc-logo.png';
 *
 *   <TTCHeader
 *     logoSrc={ttcLogo}
 *     appName="TruckQuote Pro"
 *     userName="Thinh Bui"
 *     userRole="Admin"
 *     rightNav={[
 *       { label: "Dashboard", href: "/" },
 *       { label: "Stats", href: "/stats" },
 *     ]}
 *     onSignOut={() => signOut()}
 *   />
 */
export default function TTCHeader({
  logoSrc,
  appName = '',
  appSubtitle = '',
  userName = '',
  userRole = '',
  rightNav = [],
  onSignOut = null,
  showThemeToggle = true,
}) {
  return (
    <header className="bg-[#1E1BB8] text-white">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">

        {/* Left: logo + app name */}
        <div className="flex items-center gap-3 min-w-0">
          {logoSrc && (
            <img
              src={logoSrc}
              alt="Tom's Truck Center"
              className="h-10 w-auto select-none"
              draggable={false}
            />
          )}
          {appName && (
            <>
              <span className="opacity-40 text-lg">|</span>
              <div className="min-w-0">
                <div className="text-base md:text-lg font-semibold truncate">{appName}</div>
                {appSubtitle && (
                  <div className="text-[10px] tracking-wide uppercase opacity-70 -mt-0.5 truncate">
                    {appSubtitle}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Right: user + nav + actions */}
        <div className="flex items-center gap-4 text-sm">
          {userName && (
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-white/90">{userName}</span>
              {userRole && (
                <span className="px-2 py-0.5 bg-white/15 rounded text-[11px] capitalize">
                  {userRole.replace('_', ' ')}
                </span>
              )}
            </div>
          )}

          <nav className="hidden md:flex items-center gap-4">
            {rightNav.map(item => (
              <a
                key={item.href}
                href={item.href}
                className="text-white/90 hover:text-white transition-colors"
              >
                {item.label}
              </a>
            ))}
          </nav>

          {showThemeToggle && <ThemeToggle />}

          {onSignOut && (
            <button
              onClick={onSignOut}
              className="text-white/80 hover:text-white transition-colors"
            >
              Sign out
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
