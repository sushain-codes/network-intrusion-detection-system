import React from 'react';

export const Table = ({ children, className = '' }) => {
  return (
    <div className="w-full overflow-x-auto">
      <table className={`w-full text-left text-sm text-slate-300 border-collapse ${className}`}>
        {children}
      </table>
    </div>
  );
};

export const TableHeader = ({ children, className = '' }) => {
  return (
    <thead className={`text-xs uppercase tracking-wider text-slate-400 border-b border-[#1E293B] bg-[#0B0F19]/60 ${className}`}>
      {children}
    </thead>
  );
};

export const TableBody = ({ children, className = '' }) => {
  return (
    <tbody className={`divide-y divide-[#1E293B]/60 ${className}`}>
      {children}
    </tbody>
  );
};

export const TableRow = ({ children, className = '', hover = true, onClick }) => {
  return (
    <tr
      onClick={onClick}
      className={`
        transition-colors duration-150
        ${hover ? 'hover:bg-slate-800/40' : ''}
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
    >
      {children}
    </tr>
  );
};

export const TableHead = ({ children, className = '' }) => {
  return (
    <th className={`px-4 py-3 font-medium text-slate-400 ${className}`}>
      {children}
    </th>
  );
};

export const TableCell = ({ children, className = '' }) => {
  return (
    <td className={`px-4 py-3.5 align-middle text-slate-200 ${className}`}>
      {children}
    </td>
  );
};

export default Table;

