import React, { useState } from 'react';
import { Menu, Bell, ChevronDown, User, ShieldCheck, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const Topbar = ({ isMobileOpen, setIsMobileOpen }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleSignOut = async () => {
    setShowDropdown(false);
    await logout();
    navigate('/login');
  };

  const getInitials = (name) => {
    if (!name) return 'SA';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <header className="h-20 bg-[#080C16]/80 backdrop-blur-md border-b border-[#162032] sticky top-0 z-30 px-6 flex items-center justify-between">
      {/* Left: Mobile Toggle & System Headline */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-6 h-6" />
        </button>

        <div>
          <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <span>Explainable AI-Based Network Intrusion Detection System</span>
          </h2>
          <p className="text-xs text-slate-400 font-medium hidden sm:block">
            Detect &bull; Explain &bull; Analyze Network Attacks
          </p>
        </div>
      </div>

      {/* Right: Engine Status, Notifications, User Menu */}
      <div className="flex items-center space-x-3 sm:space-x-4">
        {/* Live Engine Indicator */}
        <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-full bg-emerald-950/50 border border-emerald-800/40 text-emerald-400 text-xs font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>IDS Engine Active</span>
        </div>

        {/* Notifications */}
        <button
          className="relative p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#0F172A] border border-transparent hover:border-[#1E293B] transition-colors"
          title="Security Notifications"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-500 animate-ping" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-500" />
        </button>

        {/* User Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center space-x-3 p-1.5 pl-2.5 rounded-xl hover:bg-[#0F172A] border border-transparent hover:border-[#1E293B] transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-semibold text-xs shadow-md shadow-blue-500/20">
              {getInitials(user?.name)}
            </div>
            <div className="hidden sm:block text-left">
              <span className="block text-sm font-medium text-slate-100 leading-tight">
                {user?.name || 'Security Analyst'}
              </span>
              <span className="block text-[11px] text-slate-400 leading-tight capitalize">
                {user?.role === 'admin' ? 'SOC Administrator' : 'Security Analyst'}
              </span>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>

          {/* Dropdown Menu */}
          {showDropdown && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowDropdown(false)}
              />
              <div className="absolute right-0 mt-2 w-56 bg-[#0F172A] border border-[#1E293B] rounded-xl shadow-2xl py-1.5 z-50 backdrop-blur-lg">
                <div className="px-4 py-2 border-b border-[#1E293B]/70">
                  <p className="text-xs text-slate-400">Signed in as</p>
                  <p className="text-sm font-semibold text-white truncate">{user?.email || 'analyst@cyber.org'}</p>
                </div>
                <button
                  onClick={() => {
                    setShowDropdown(false);
                    navigate('/profile');
                  }}
                  className="w-full flex items-center px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800/60"
                >
                  <User className="w-4 h-4 mr-2.5 text-blue-400" />
                  Account Profile
                </button>
                <div className="border-t border-[#1E293B]/70 my-1" />
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center px-4 py-2 text-sm text-rose-400 hover:bg-rose-950/20"
                >
                  <LogOut className="w-4 h-4 mr-2.5" />
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Topbar;
