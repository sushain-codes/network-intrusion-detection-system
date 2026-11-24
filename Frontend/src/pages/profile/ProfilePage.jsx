import React, { useState } from 'react';
import { User, Mail, Shield, Key, Laptop, Clock, CheckCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Input from '../../components/common/Input';
import { useAuth } from '../../context/AuthContext';

export const ProfilePage = () => {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name || 'Security Analyst');
  const [email] = useState(user?.email || 'analyst@cyber.org');
  const [isSaved, setIsSaved] = useState(false);

  const getInitials = (userName) => {
    if (!userName) return 'SA';
    const parts = userName.trim().split(' ');
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const handleSave = (e) => {
    e.preventDefault();
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
          <User className="w-6 h-6 text-blue-500" />
          <span>Security Analyst Profile</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Personal identification, role authorization, and session security settings
        </p>
      </div>

      {/* Profile Overview Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-5">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold shadow-xl shadow-blue-500/25 flex-shrink-0">
              {getInitials(user?.name)}
            </div>
            <div className="flex-1 text-center sm:text-left">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold text-white">{user?.name || name}</h2>
                  <p className="text-xs text-slate-400 mt-0.5">{user?.email || email}</p>
                </div>
                <Badge variant={user?.role === 'admin' ? 'purple' : 'info'} dot>
                  {user?.role === 'admin' ? 'SOC Administrator' : 'Security Operations (Analyst)'}
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5 pt-4 border-t border-[#1E293B]">
                <div>
                  <span className="block text-[11px] text-slate-500 uppercase tracking-wider">Account ID</span>
                  <span className="font-mono text-xs text-slate-300">
                    {user?._id ? `#${String(user._id).slice(-8)}` : '#USR-89214'}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] text-slate-500 uppercase tracking-wider">Access Clearance</span>
                  <span className="text-xs text-emerald-400 font-medium">Level 3 (Full Read/Write)</span>
                </div>
                <div>
                  <span className="block text-[11px] text-slate-500 uppercase tracking-wider">Member Since</span>
                  <span className="text-xs text-blue-400 font-medium">
                    {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Active'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile Details Form */}
      <Card>
        <CardHeader>
          <CardTitle>
            <span>Personal Information</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                icon={User}
              />
              <Input
                label="Email Address"
                value={user?.email || email}
                disabled
                icon={Mail}
                helperText="Email is permanently bound to this account"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              {isSaved ? (
                <span className="text-xs text-emerald-400 font-medium flex items-center">
                  <CheckCircle className="w-4 h-4 mr-1.5" /> Profile updated successfully!
                </span>
              ) : <div />}
              <Button type="submit" variant="primary" size="sm">
                Save Changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Active Sessions & Security */}
      <Card>
        <CardHeader>
          <CardTitle>
            <span>Active Login Sessions</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-[#080C16] border border-[#1E293B] flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                  <Laptop className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">Current Workstation (Active Session)</p>
                  <p className="text-[11px] text-slate-400">JWT Authenticated &bull; Encrypted Bearer Channel</p>
                </div>
              </div>
              <Badge variant="normal" size="sm" dot>Active</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfilePage;
