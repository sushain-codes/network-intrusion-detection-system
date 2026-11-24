import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Activity,
  Clock,
  Layers,
  User,
  LogOut,
  Shield,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Network Prediction', path: '/predict', icon: Activity },
  { name: 'Prediction History', path: '/history', icon: Clock },
  { name: 'Explainability', path: '/explain', icon: Layers },
];

export const Sidebar = ({ isCollapsed, setIsCollapsed, isMobileOpen, setIsMobileOpen }) => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
    if (isMobileOpen) setIsMobileOpen(false);
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`
          fixed top-0 bottom-0 left-0 z-50
          flex flex-col justify-between
          bg-[#080C16] border-r border-[#162032]
          transition-all duration-300 ease-in-out
          ${isCollapsed ? 'w-20' : 'w-64'}
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Top: Logo & Branding */}
        <div>
          <div className="flex items-center justify-between p-5 border-b border-[#162032]/80">
            <div className="flex items-center space-x-3 overflow-hidden">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/30 flex-shrink-0">
                <Shield className="w-5 h-5 text-white" />
              </div>
              {!isCollapsed && (
                <div className="transition-opacity duration-200">
                  <h1 className="text-base font-bold tracking-tight text-white leading-none">
                    XAI-NIDS
                  </h1>
                  <p className="text-[11px] text-slate-400 mt-1 font-medium tracking-wide">
                    Network Intrusion Detection
                  </p>
                </div>
              )}
            </div>

            {/* Desktop Collapse Toggle */}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="hidden lg:flex w-7 h-7 rounded-lg bg-[#0F172A] border border-[#1E293B] items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1.5 mt-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileOpen(false)}
                  className={({ isActive }) => `
                    flex items-center px-3.5 py-3 rounded-xl font-medium text-sm
                    transition-all duration-200 group relative
                    ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-semibold'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-[#0F172A]'
                    }
                    ${isCollapsed ? 'justify-center' : ''}
                  `}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${isCollapsed ? '' : 'mr-3'}`} />
                  {!isCollapsed && <span>{item.name}</span>}

                  {/* Tooltip when collapsed */}
                  {isCollapsed && (
                    <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-[#0F172A] border border-[#1E293B] text-slate-100 text-xs rounded-lg shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                      {item.name}
                    </div>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section: Profile, Logout & Cyber graphic decoration */}
        <div className="p-3 relative overflow-hidden">
          {/* Subtle cyber grid glow on bottom left matching reference */}
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

          <div className="border-t border-[#162032] pt-3 space-y-1.5 relative z-10">
            <NavLink
              to="/profile"
              onClick={() => setIsMobileOpen(false)}
              className={({ isActive }) => `
                flex items-center px-3.5 py-2.5 rounded-xl font-medium text-sm
                transition-all duration-200 group relative
                ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-semibold'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-[#0F172A]'
                }
                ${isCollapsed ? 'justify-center' : ''}
              `}
            >
              <User className={`w-5 h-5 flex-shrink-0 ${isCollapsed ? '' : 'mr-3'}`} />
              {!isCollapsed && <span>Profile</span>}
              {isCollapsed && (
                <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-[#0F172A] border border-[#1E293B] text-slate-100 text-xs rounded-lg shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                  Profile
                </div>
              )}
            </NavLink>

            <button
              onClick={handleLogout}
              className={`
                w-full flex items-center px-3.5 py-2.5 rounded-xl font-medium text-sm
                text-slate-400 hover:text-rose-400 hover:bg-rose-950/20
                transition-all duration-200 group relative
                ${isCollapsed ? 'justify-center' : ''}
              `}
            >
              <LogOut className={`w-5 h-5 flex-shrink-0 ${isCollapsed ? '' : 'mr-3'}`} />
              {!isCollapsed && <span>Logout</span>}
              {isCollapsed && (
                <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-[#0F172A] border border-[#1E293B] text-rose-300 text-xs rounded-lg shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                  Logout
                </div>
              )}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;

