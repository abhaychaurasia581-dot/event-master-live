import React from 'react';

const Input = React.forwardRef(({ label, error, className = '', rightElement, ...props }, ref) => {
  return (
    <div className={`flex flex-col w-full ${className}`}>
      {label && <label className="mb-1 text-sm font-medium text-gray-700">{label}</label>}
      <div className="relative w-full">
        <input
          ref={ref}
          className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${
            error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'
          } ${rightElement ? 'pr-10' : ''}`}
          {...props}
        />
        {rightElement && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            {rightElement}
          </div>
        )}
      </div>
      {error && <span className="mt-1 text-xs text-red-500">{error}</span>}
    </div>
  );
});

Input.displayName = 'Input';
export default Input;
