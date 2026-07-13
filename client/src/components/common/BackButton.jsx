import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const BackButton = ({ className = "" }) => {
  const navigate = useNavigate();
  return (
    <button 
      onClick={() => navigate(-1)} 
      className={`flex items-center gap-2 text-gray-500 hover:text-indigo-600 transition-colors mb-6 font-medium ${className}`}
    >
      <ArrowLeft className="w-4 h-4" /> Back
    </button>
  );
};

export default BackButton;
