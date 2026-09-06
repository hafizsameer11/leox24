import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  badge?: string | number | null;
  roles?: string[];
  modules?: string[];
  /** Extra context on hover (e.g. Lead list vs file import) */
  linkTitle?: string;
}

interface SidebarProps {
  iconOnly?: boolean;
}

export default function Sidebar({ iconOnly = false }: SidebarProps) {
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

  const navItems: NavItem[] = [
    { path: '/dashboard', label: t('sidebar.dashboard'), icon: '📊', roles: ['super_admin', 'company_admin', 'manager', 'staff'] },
    { path: '/sales', label: t('sidebar.sales'), icon: '💰', badge: null, roles: ['super_admin', 'company_admin', 'manager', 'staff'] },
    { path: '/leads', label: t('sidebar.leads'), icon: '🎯', badge: null, roles: ['super_admin', 'company_admin', 'manager', 'staff'], linkTitle: t('sidebar.leadsLinkTitle') },
    { path: '/tg-leads', label: t('sidebar.tgLeads'), icon: '📰', badge: null, roles: ['super_admin', 'company_admin', 'manager', 'staff'] },
    { path: '/mypetplus-leads', label: 'MyPet Plus Leads', icon: '🐾', badge: null, roles: ['super_admin', 'company_admin', 'manager', 'staff'] },
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

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  return (
    <aside className={`sticky top-0 h-screen ${iconOnly ? 'w-20' : 'w-64'} border-r border-line bg-gradient-to-b from-white/95 to-white/90 backdrop-blur-sm flex flex-col transition-all duration-300`}>
      {/* Brand */}
      <div className={`${iconOnly ? 'p-3' : 'p-5'} border-b border-line`}>
        <div className={`flex items-center ${iconOnly ? 'justify-center' : 'gap-3'} mb-1`}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-aqua-3 to-aqua-5 shadow-lg shadow-aqua-5/25 flex items-center justify-center">
            <span className="text-white font-bold text-lg">L</span>
          </div>
          {!iconOnly && (
            <div>
              <h1 className="text-base font-bold text-ink leading-tight">LEO24 CRM</h1>
              <p className="text-xs text-muted leading-tight">{t('sidebar.enterprisePlatform')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {filteredNavItems.map((item) => {
          const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center ${iconOnly ? 'justify-center' : 'justify-between'} ${iconOnly ? 'px-2' : 'px-3'} py-2.5 rounded-xl border transition-all duration-150 ${
                isActive
                  ? 'bg-gradient-to-r from-aqua-3/35 to-aqua-5/12 border-aqua-5/45 shadow-sm shadow-aqua-5/10'
                  : 'border-line hover:border-aqua-4/35 hover:bg-aqua-1/30'
              }`}
              title={item.linkTitle ?? (iconOnly ? item.label : undefined)}
            >
              <div className={`flex items-center ${iconOnly ? '' : 'gap-3'}`}>
                <span className="text-lg">{item.icon}</span>
                {!iconOnly && <span className="text-sm font-medium text-ink">{item.label}</span>}
              </div>
              {!iconOnly && item.badge !== null && item.badge !== undefined && (
                <span className="text-xs px-2 py-0.5 rounded-full border border-line bg-aqua-1/65 text-ink font-medium">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Info */}
      <div className={`${iconOnly ? 'p-2' : 'p-4'} border-t border-line bg-aqua-1/20`}>
        {!iconOnly && (
          <div className="mb-3">
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
        )}
        <button
          onClick={handleLogout}
          className={`w-full ${iconOnly ? 'px-2 py-2' : 'px-3 py-2'} text-sm border border-line rounded-lg hover:bg-white hover:border-aqua-4/35 transition-colors text-ink font-medium`}
          title={iconOnly ? t('sidebar.logout') : undefined}
        >
          {iconOnly ? '🚪' : t('sidebar.logout')}
        </button>
      </div>
    </aside>
  );
}
