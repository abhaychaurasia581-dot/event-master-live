import React from 'react';
import { Outlet } from 'react-router-dom';

const AdminLayout = () => {
  return (
    <div className="relative w-full h-full flex flex-col rounded-2xl overflow-hidden min-h-[80vh]">
      <div className="relative z-10 p-6 flex-grow">
        <Outlet />
      </div>
    </div>
  );
};

export default AdminLayout;
