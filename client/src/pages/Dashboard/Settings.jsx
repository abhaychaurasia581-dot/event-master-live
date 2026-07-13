import React, { useState } from 'react';
import { Shield, ShieldAlert, Key } from 'lucide-react';
import Button from '../../components/common/Button';
import BackButton from '../../components/common/BackButton';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';

const Settings = () => {
  const { user } = useAuthStore();
  const [is2FAEnabled, setIs2FAEnabled] = useState(user?.is_2fa_enabled || false);
  const [loading, setLoading] = useState(false);

  const handleToggle2FA = () => {
    setLoading(true);
    // Simulate Backend API Call latency
    setTimeout(() => {
      setIs2FAEnabled(!is2FAEnabled);
      setLoading(false);
      toast.success(is2FAEnabled ? '2FA has been disabled' : '2FA has been enabled securely');
    }, 1500);
  };

  return (
    <div className="w-full h-full flex-grow flex flex-col mx-auto py-8">
      <BackButton />
      <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-8">Security Settings</h1>
      
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-8 border-b border-gray-100 flex flex-col sm:flex-row items-start gap-6">
          <div className={`p-4 rounded-full ${is2FAEnabled ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
            {is2FAEnabled ? <Shield className="h-8 w-8" /> : <ShieldAlert className="h-8 w-8" />}
          </div>
          <div className="flex-grow">
            <h2 className="text-xl font-bold text-gray-900">Two-Factor Authentication (2FA)</h2>
            <p className="text-gray-500 mt-2 text-sm leading-relaxed max-w-2xl">
              Add an extra layer of security to your account. When enabled, you'll need to enter a secure OTP code from your authenticator app (like Google Authenticator or Authy) to log in.
            </p>
          </div>
          <div className="mt-4 sm:mt-0">
            <Button 
              variant={is2FAEnabled ? 'danger' : 'primary'} 
              onClick={handleToggle2FA}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              {loading ? 'Processing...' : is2FAEnabled ? 'Disable 2FA' : 'Enable 2FA'}
            </Button>
          </div>
        </div>
        
        {is2FAEnabled && (
          <div className="p-8 bg-gray-50 flex flex-col sm:flex-row items-start gap-6 border-b border-gray-200">
            <div className="p-4 bg-indigo-100 text-indigo-600 rounded-full">
              <Key className="h-8 w-8" />
            </div>
            <div className="flex-grow">
              <h2 className="text-lg font-bold text-gray-900">Recovery Codes</h2>
              <p className="text-gray-500 mt-2 text-sm mb-4 max-w-2xl leading-relaxed">
                Emergency recovery codes can be used to access your account in the event you lose access to your authenticator device and cannot receive two-factor authentication codes. Keep these safe.
              </p>
              <Button variant="outline" className="text-sm bg-white">Regenerate Recovery Codes</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
