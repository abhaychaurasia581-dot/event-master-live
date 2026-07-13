import React from 'react';
import BackButton from '../../components/common/BackButton';

const PrivacyPolicy = () => {
  return (
    <div className="w-full h-full flex-grow flex flex-col mx-auto py-12 px-6">
      <BackButton />
      <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-8">Privacy Policy</h1>
      
      <div className="prose prose-indigo max-w-none text-gray-600">
        <p className="lead text-xl text-gray-500 mb-8">
          At EventMaster, your privacy is our priority. This Privacy Policy outlines the types of information we collect, how it's used, and the steps we take to protect your personal data.
        </p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">1. Information We Collect</h2>
        <p className="mb-4">
          When you register for an account, we collect personal information such as your name, email address, and payment details. We also collect usage data (such as events viewed, wishlisted, or booked) to improve your experience.
        </p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">2. How We Use Your Data</h2>
        <p className="mb-4">
          We use your data strictly for:
        </p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>Processing your event bookings securely</li>
          <li>Sending you tickets, booking confirmations, and essential updates</li>
          <li>Recommending events tailored to your preferences</li>
          <li>Enhancing the security and functionality of the EventMaster platform</li>
        </ul>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">3. Data Security</h2>
        <p className="mb-4">
          All personal and payment data is encrypted using industry-standard SSL protocols. We do not store your credit card information directly on our servers; it is handled safely by our trusted payment gateways.
        </p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">4. Your Rights</h2>
        <p className="mb-4">
          You have the right to access, update, or delete your personal information at any time via your Account Settings. You may also opt out of marketing communications.
        </p>

        <hr className="my-10 border-gray-200" />
        <p className="text-sm text-gray-500">Last updated: July 2026</p>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
