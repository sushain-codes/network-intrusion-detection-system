import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react';
import AuthLayout from '../../components/layout/AuthLayout';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { useAuth } from '../../context/AuthContext';

export const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Please provide both email and password.');
      return;
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError('Please provide a valid email address.');
      return;
    }

    setIsLoading(true);

    try {
      await login(trimmedEmail, password);
      // Redirect to the originally attempted route or default to /dashboard
      const destination = location.state?.from?.pathname || '/dashboard';
      navigate(destination, { replace: true });
    } catch (err) {
      console.error('Login error:', err);
      const serverMessage = err.response?.data?.message;
      if (serverMessage) {
        setError(serverMessage);
      } else if (err.code === 'ERR_NETWORK') {
        setError('Unable to connect to security backend service. Please check server connectivity.');
      } else {
        setError('Authentication failed. Please verify your credentials and try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Security Operations Login"
      subtitle="Authenticate with your organizational security credentials"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800/60 text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <Input
          label="Work Email"
          type="email"
          placeholder="name@organization.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          icon={Mail}
          disabled={isLoading}
          required
        />

        <div className="relative">
          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            icon={Lock}
            disabled={isLoading}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-8 text-slate-400 hover:text-slate-200"
            disabled={isLoading}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex items-center justify-between text-xs pt-1">
          <label className="flex items-center space-x-2 text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              defaultChecked
              className="rounded bg-[#080C16] border-[#1E293B] text-blue-600 focus:ring-0 focus:ring-offset-0"
            />
            <span>Remember session</span>
          </label>
          <a href="#forgot" className="text-blue-400 hover:text-blue-300 transition-colors">
            Forgot password?
          </a>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full mt-2 font-semibold"
          loading={isLoading}
          disabled={isLoading}
          icon={ArrowRight}
          iconPosition="right"
        >
          {isLoading ? 'Authenticating...' : 'Access Console'}
        </Button>

        <div className="mt-5 text-center text-xs text-slate-400 pt-2 border-t border-[#1E293B]/70">
          <span>New analyst or administrator? </span>
          <Link to="/register" className="text-blue-400 hover:text-blue-300 font-medium">
            Register Account
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
};

export default LoginPage;
