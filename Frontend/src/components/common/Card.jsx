import React from 'react';

export const Card = ({ children, className = '', glow = false, ...props }) => {
  return (
    <div
      className={`
        bg-[#0F172A]/90 border border-[#1E293B] rounded-xl
        shadow-xl backdrop-blur-md transition-all duration-200
        ${glow ? 'shadow-glow-blue border-blue-500/30' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader = ({ children, className = '', ...props }) => {
  return (
    <div className={`p-5 pb-3 border-b border-[#1E293B]/70 ${className}`} {...props}>
      {children}
    </div>
  );
};

export const CardTitle = ({ children, className = '', ...props }) => {
  return (
    <h3 className={`text-base font-semibold text-slate-100 flex items-center justify-between ${className}`} {...props}>
      {children}
    </h3>
  );
};

export const CardDescription = ({ children, className = '', ...props }) => {
  return (
    <p className={`text-xs text-slate-400 mt-1 ${className}`} {...props}>
      {children}
    </p>
  );
};

export const CardContent = ({ children, className = '', ...props }) => {
  return (
    <div className={`p-5 ${className}`} {...props}>
      {children}
    </div>
  );
};

export const CardFooter = ({ children, className = '', ...props }) => {
  return (
    <div className={`p-5 pt-3 border-t border-[#1E293B]/70 flex items-center justify-between ${className}`} {...props}>
      {children}
    </div>
  );
};

export default Card;
