import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';

/** A directly navigable entry. */
interface NavLeaf {
  path: string;
  label: string;
  icon: string;
  badge?: string | number | null;
  roles?: string[];
  modules?: string[];
  /** Extra context on hover (e.g. Lead list vs file import) */
  linkTitle?: string;
}

/** A collapsible group whose children each lead to their own page. */
interface NavGroup {
  key: string;
  label: string;
  icon: string;
  roles?: string[];
  modules?: string[];
  children: NavLeaf[];
}

type NavEntry = NavLeaf | NavGroup;

interface SidebarProps {
  iconOnly?: boolean;
  mobileOpen?: boolean;
  onNavigate?: () => void;
}

export default function Sidebar({ iconOnly = false, mobileOpen = false, onNavigate }: SidebarProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);


  // Check if user has access to a module (for future module-based permissions)
  const hasModuleAccess = (modules?: string[]) => {
    if (!modules || modules.length === 0) return true;
    // For now, all users have access. Later, check against user.permissions
    return true;
  };

  // Check if user has access based on role
  const hasRoleAccess = (roles?: string[]) => {
    if (!roles || roles.length === 0) return true;
    if (!user) return false;
    return roles.includes(user.role);
  };

  const navItems: NavEntry[] = [
    { path: '/dashboard', label: t('sidebar.dashboard'), icon: '📊', roles: ['super_admin', 'company_admin', 'manager', 'staff'] },
    { path: '/sales', label: t('sidebar.sales'), icon: '💰', badge: null, roles: ['super_admin', 'company_admin', 'manager', 'staff'] },
    { path: '/leads', label: t('sidebar.leads'), icon: '🎯', badge: null, roles: ['super_admin', 'company_admin', 'manager', 'staff'], linkTitle: t('sidebar.leadsLinkTitle') },
    {
      key: 'project-leads',
      label: t('sidebar.projectLeads'),
      icon: '📂',
      roles: ['super_admin', 'company_admin', 'manager', 'staff'],
      children: [
        { path: '/tg-leads', label: t('sidebar.tgLeads'), icon: '📰', badge: null, roles: ['super_admin', 'company_admin', 'manager', 'staff'] },
        { path: '/mypetplus-leads', label: 'MyPet Plus Leads', icon: '🐾', badge: null, roles: ['super_admin', 'company_admin', 'manager', 'staff'] },
        { path: '/vista-express-leads', label: t('sidebar.vistaExpressLeads'), icon: '🛒', badge: null, roles: ['super_admin', 'company_admin', 'manager', 'staff'] },
      ],
    },
    { path: '/calls', label: t('sidebar.calls'), icon: '📞', badge: null, roles: ['super_admin', 'company_admin', 'manager', 'staff'] },
    { path: '/sms', label: t('sidebar.sms'), icon: '💬', badge: null, roles: ['super_admin'] },
    { path: '/emails', label: t('sidebar.emails'), icon: '📧', badge: null, roles: ['super_admin'] },
    { path: '/support', label: t('sidebar.support'), icon: '🛠️', badge: null, roles: ['super_admin', 'company_admin', 'manager', 'staff'] },
    { path: '/marketing', label: t('sidebar.marketing'), icon: '📢', roles: ['super_admin', 'company_admin', 'manager'] },
    { path: '/customers', label: t('sidebar.customers'), icon: '👥', roles: ['super_admin', 'company_admin', 'manager', 'staff'] },
    { path: '/categories', label: t('sidebar.categories'), icon: '🏷️', roles: ['super_admin', 'company_admin', 'manager'] },
    { path: '/projects', label: t('sidebar.projects'), icon: '🔗', roles: ['super_admin', 'company_admin', 'manager'] },
    { path: '/project-management', label: t('sidebar.projectManagement'), icon: '🔐', roles: ['super_admin'] },
    { path: '/companies', label: t('sidebar.companies'), icon: '🏢', roles: ['super_admin'] },
    { path: '/users', label: t('sidebar.users'), icon: '👤', roles: ['super_admin', 'company_admin'] },
    { path: '/settings', label: t('sidebar.settings'), icon: '⚙️', roles: ['super_admin', 'company_admin'] },
  ];

  // Add subscription link if company needs subscription
  const hasActiveSubscription = user?.company?.subscription_status === 'active';
  const needsSubscription = user?.company && !hasActiveSubscription &&
                           (user.company.status === 'approved' || 
                            user.company.subscription_status === 'approved' ||
                            (user.company.status === 'active' && user.company.subscription_status !== 'active'));
  
  if (needsSubscription && user?.role !== 'super_admin') {
    navItems.push({ 
      path: '/subscribe', 
      label: t('sidebar.subscribe'), 
      icon: '💳', 
      roles: ['company_admin', 'manager', 'staff'] 
    });
  }

  const filteredNavItems = navItems.filter(
    (item) => hasRoleAccess(item.roles) && hasModuleAccess(item.modules)
  );

  /**
   * Groups start collapsed, except one that contains the current route — so
   * arriving on a project leads page always shows where you are. Once the user
   * toggles a group their choice sticks.
   */
  const [groupOverrides, setGroupOverrides] = useState<Record<string, boolean>>({});

  const matchesPath = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  const groupChildren = (group: NavGroup) =>
    group.children.filter((child) => hasRoleAccess(child.roles) && hasModuleAccess(child.modules));

  const isGroupActive = (group: NavGroup) => groupChildren(group).some((child) => matchesPath(child.path));

  const isGroupOpen = (group: NavGroup) => groupOverrides[group.key] ?? isGroupActive(group);

  const toggleGroup = (key: string) => {
    setGroupOverrides((prev) => ({ ...prev, [key]: !(prev[key] ?? false) }));
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex h-[100dvh] w-[min(86vw,20rem)] -translate-x-full flex-col border-r border-line bg-gradient-to-b from-white to-white/95 shadow-2xl shadow-ink/15 backdrop-blur-sm transition-transform duration-300 ease-out ${
        mobileOpen ? 'translate-x-0' : ''
      } lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:translate-x-0 lg:shadow-none ${iconOnly ? 'lg:w-20' : 'lg:w-64'}`}
      aria-label={t('layout.primaryNavigation', { defaultValue: 'Primary navigation' })}
    >
      {/* Brand */}
      <div className={`${iconOnly ? 'p-5 lg:p-3' : 'p-5'} border-b border-line`}>
        <div className={`mb-1 flex items-center ${iconOnly ? 'gap-3 lg:justify-center lg:gap-0' : 'gap-3'}`}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-aqua-3 to-aqua-5 shadow-lg shadow-aqua-5/25 flex items-center justify-center">
            <span className="text-white font-bold text-lg">L</span>
          </div>
          <div className={iconOnly ? 'lg:hidden' : ''}>
            <h1 className="text-base font-bold text-ink leading-tight">LEO24 CRM</h1>
            <p className="text-xs text-muted leading-tight">{t('sidebar.enterprisePlatform')}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {filteredNavItems.map((item) => {
          // Collapsible group: renders a toggle plus one link per child.
          if ('children' in item) {
            const group = item;
            const children = groupChildren(group);
            const active = isGroupActive(group);
            const open = isGroupOpen(group) && children.length > 0;

            // Nothing this user can actually open — do not show a dead group.
            if (children.length === 0) return null;

            return (
              <div key={group.key}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.key)}
                  aria-expanded={open}
                  aria-controls={`${group.key}-submenu`}
                  className={`flex w-full items-center ${iconOnly ? 'justify-between lg:justify-center' : 'justify-between'} ${iconOnly ? 'px-3 lg:px-2' : 'px-3'} py-2.5 rounded-xl border transition-all duration-150 ${
                    active
                      ? 'bg-gradient-to-r from-aqua-3/35 to-aqua-5/12 border-aqua-5/45 shadow-sm shadow-aqua-5/10'
                      : 'border-line hover:border-aqua-4/35 hover:bg-aqua-1/30'
                  }`}
                  title={iconOnly ? group.label : undefined}
                >
                  <span className={`flex items-center ${iconOnly ? 'gap-3 lg:gap-0' : 'gap-3'}`}>
                    <span className="text-lg">{group.icon}</span>
                    <span className={`text-sm font-medium text-ink ${iconOnly ? 'lg:hidden' : ''}`}>
                      {group.label}
                    </span>
                  </span>
                  <span className={`text-xs text-muted transition-transform duration-200 ${iconOnly ? 'lg:hidden' : ''} ${open ? 'rotate-90' : ''}`}>
                    ›
                  </span>
                </button>

                {open && (
                  <ul
                    id={`${group.key}-submenu`}
                    className="mt-1 space-y-1 border-l border-line pl-2 ml-4"
                  >
                    {children.map((child) => {
                      const childActive = matchesPath(child.path);
                      return (
                        <li key={child.path}>
                          <Link
                            to={child.path}
                            onClick={onNavigate}
                            className={`flex items-center justify-between rounded-lg border px-2.5 py-2 transition-all duration-150 ${
                              childActive
                                ? 'border-aqua-5/45 bg-aqua-3/25 text-ink shadow-sm shadow-aqua-5/10'
                                : 'border-transparent text-muted hover:border-aqua-4/30 hover:bg-aqua-1/30 hover:text-ink'
                            }`}
                            title={child.linkTitle ?? (iconOnly ? child.label : undefined)}
                            aria-current={childActive ? 'page' : undefined}
                          >
                            <span className="flex min-w-0 items-center gap-2.5">
                              <span className="text-base">{child.icon}</span>
                              <span className={`truncate text-sm font-medium ${iconOnly ? 'lg:hidden' : ''}`}>
                                {child.label}
                              </span>
                            </span>
                            {child.badge !== null && child.badge !== undefined && (
                              <span className={`rounded-full border border-line bg-aqua-1/65 px-1.5 py-0.5 text-xs font-medium text-ink ${iconOnly ? 'lg:hidden' : ''}`}>
                                {child.badge}
                              </span>
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          }

          // Plain link — rendering is unchanged from before the group existed.
          const isActive = matchesPath(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={`flex items-center ${iconOnly ? 'justify-between lg:justify-center' : 'justify-between'} ${iconOnly ? 'px-3 lg:px-2' : 'px-3'} py-2.5 rounded-xl border transition-all duration-150 ${
                isActive
                  ? 'bg-gradient-to-r from-aqua-3/35 to-aqua-5/12 border-aqua-5/45 shadow-sm shadow-aqua-5/10'
                  : 'border-line hover:border-aqua-4/35 hover:bg-aqua-1/30'
              }`}
              title={item.linkTitle ?? (iconOnly ? item.label : undefined)}
            >
              <div className={`flex items-center ${iconOnly ? 'gap-3 lg:gap-0' : 'gap-3'}`}>
                <span className="text-lg">{item.icon}</span>
                <span className={`text-sm font-medium text-ink ${iconOnly ? 'lg:hidden' : ''}`}>{item.label}</span>
              </div>
              {item.badge !== null && item.badge !== undefined && (
                <span className={`rounded-full border border-line bg-aqua-1/65 px-2 py-0.5 text-xs font-medium text-ink ${iconOnly ? 'lg:hidden' : ''}`}>
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Info */}
      <div className={`${iconOnly ? 'p-4 lg:p-2' : 'p-4'} border-t border-line bg-aqua-1/20`}>
        <div className={`mb-3 ${iconOnly ? 'lg:hidden' : ''}`}>
          <p className="text-sm font-semibold text-ink mb-0.5">{user?.name || t('sidebar.user')}</p>
          <p className="text-xs text-muted mb-1">{user?.email}</p>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-0.5 rounded-full bg-aqua-5/15 text-aqua-5 font-medium capitalize">
              {user?.role?.replace('_', ' ')}
            </span>
            {user?.company && (
              <span className="text-xs text-muted truncate" title={user.company.name}>
                {user.company.name}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={handleLogout}
          className={`w-full ${iconOnly ? 'px-3 py-2 lg:px-2' : 'px-3 py-2'} text-sm border border-line rounded-lg hover:bg-white hover:border-aqua-4/35 transition-colors text-ink font-medium`}
          title={iconOnly ? t('sidebar.logout') : undefined}
        >
          {iconOnly ? <><span className="lg:hidden">{t('sidebar.logout')}</span><span className="hidden lg:inline">🚪</span></> : t('sidebar.logout')}
        </button>
      </div>
    </aside>
  );
}
