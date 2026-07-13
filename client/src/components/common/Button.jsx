import React from 'react';
import { Link } from 'react-router-dom';

const Button = ({ children, variant = 'primary', className = '', to, ...props }) => {
  const baseStyle = "px-4 py-2 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md hover:shadow-lg",
    secondary: "bg-gray-200 text-gray-800 hover:bg-gray-300",
    outline: "border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50",
    danger: "bg-red-600 text-white hover:bg-red-700 shadow-md",
  };

  const finalClassName = `${baseStyle} ${variants[variant]} ${className}`;

  if (to) {
    return (
      <Link to={to} className={finalClassName} {...props}>
        {children}
      </Link>
    );
  }

  return (
    <button 
      className={finalClassName}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
