import React from 'react';
import { Shield, Lock, Activity, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';

export const AuthLayout = ({ children, title, subtitle }) => {
  return (
    <div className="min-h-screen bg-[#080C14] flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Abstract Glowing Cyber Mesh Background Elements */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-blue-600/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-indigo-600/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#1E293B_1px,transparent_1px)] [background-size:24px_24px] opacity-25 pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center space-x-3 group">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:scale-105 transition-transform duration-200">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div className="text-left">
              <h1 className="text-xl font-bold tracking-tight text-white leading-none">
                XAI-NIDS
              </h1>
              <p className="text-xs text-blue-400 mt-1 font-medium tracking-wide">
                Intrusion Detection System
              </p>
            </div>
          </Link>

          {title && (
            <h2 className="text-xl font-semibold text-slate-100 mt-6 tracking-tight">
              {title}
            </h2>
          )}
          {subtitle && (
            <p className="text-xs text-slate-400 mt-1.5">
              {subtitle}
            </p>
          )}
        </div>

        {/* Card Body */}
        <div className="bg-[#0F172A]/90 border border-[#1E293B] rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          {children}
        </div>

        {/* Footer info */}
        <div className="mt-8 text-center text-xs text-slate-500 flex items-center justify-center space-x-4">
          <span className="flex items-center">
            <Lock className="w-3.5 h-3.5 mr-1 text-slate-500" /> End-to-End Encrypted
          </span>
          <span>&bull;</span>
          <span className="flex items-center">
            <Activity className="w-3.5 h-3.5 mr-1 text-emerald-500" /> ML Engine Online
          </span>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;

