import React from 'react';
import BackButton from '../../components/common/BackButton';

const TermsOfService = () => {
  return (
    <div className="w-full h-full flex-grow flex flex-col mx-auto py-12 px-6">
      <BackButton />
      <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-8">Terms of Service</h1>
      
      <div className="prose prose-indigo max-w-none text-gray-600">
        <p className="lead text-xl text-gray-500 mb-8">
          Welcome to EventMaster. By accessing or using our platform, you agree to be bound by the following terms and conditions.
        </p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">1. Acceptance of Terms</h2>
        <p className="mb-4">
          By registering for an account or using EventMaster to browse, host, or book events, you agree to comply with all applicable laws and these Terms of Service.
        </p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">2. User Responsibilities</h2>
        <p className="mb-4">
          You are responsible for maintaining the confidentiality of your account credentials (including 2FA codes). Any activity occurring under your account is your responsibility.
        </p>
        
        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">3. Booking & Refunds</h2>
        <p className="mb-4">
          All ticket purchases made through EventMaster are subject to the specific event organizer's refund policy. EventMaster acts purely as a facilitator and is not liable for event cancellations, postponements, or unfulfilled promises by event organizers.
        </p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">4. Hosting Events</h2>
        <p className="mb-4">
          Organizers utilizing EventMaster to host events must ensure their events comply with local regulations and do not promote illegal or harmful activities. We reserve the right to remove any event or suspend any organizer account at our sole discretion.
        </p>

        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">5. Limitation of Liability</h2>
        <p className="mb-4">
          EventMaster is provided "as is". We are not responsible for direct, indirect, incidental, or consequential damages resulting from the use or inability to use our platform.
        </p>

        <hr className="my-10 border-gray-200" />
        <p className="text-sm text-gray-500">Last updated: July 2026</p>
      </div>
    </div>
  );
};

export default TermsOfService;
