import React, { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import Button from '../../components/common/Button';
import { CheckCircle, Shield, CreditCard, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../services/api';
import { bookingApi } from '../../services/bookingApi';

const Checkout = () => {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  
  // Extract event and booking details from navigation state
  const event = location.state?.event || { title: 'Event Details Pending', ticket_price: 0 };
  const [tickets, setTickets] = useState(1);
  const total = Number(event.ticket_price || 0) * tickets;

  const handlePayment = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Step 1: Create the Booking first
      let bookingIdToPay = location.state?.bookingId;
      
      if (!bookingIdToPay) {
        const bookingRes = await bookingApi.createBooking({
          eventId: event.id,
          numberOfSeats: tickets
        });
        bookingIdToPay = bookingRes.data?.id || bookingRes.data?.booking?.id;
        
        if (!bookingIdToPay) {
           throw new Error("Failed to retrieve booking ID from creation response");
        }
      }

      // Step 2: Initialize Payment
      const response = await api.post('/api/v2/payments/create-order', {
        bookingId: bookingIdToPay,
        gateway: 'stripe'
      });
      
      toast.success('Payment securely initiated!');
      if (response.data?.data?.url) {
        window.location.href = response.data.data.url;
      } else {
        navigate('/');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to initiate payment gateway');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-full flex-grow flex flex-col mx-auto mt-8">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-500 hover:text-indigo-600 transition-colors mb-6 font-medium">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden flex flex-col md:flex-row">
        
        {/* Left Side: Order Summary */}
        <div className="md:w-1/2 p-8 md:border-r border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 border-b border-gray-100 pb-4">Order Summary</h2>
          
          <div className="flex flex-col gap-4">
            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
              <h3 className="font-bold text-indigo-900">{event.title}</h3>
              <p className="text-sm text-indigo-700 mt-1">
                {event.event_date ? new Date(event.event_date).toLocaleDateString() : 'TBD'} • {event.venue || 'TBD'}
              </p>
            </div>
            
            <div className="flex items-center justify-between mt-4">
              <span className="text-gray-600 font-medium">Ticket Price</span>
              <span className="font-bold text-gray-900">${event.ticket_price || 0}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-600 font-medium">Quantity</span>
              <div className="flex items-center gap-3 border border-gray-200 rounded-lg p-1 bg-white">
                <button onClick={() => setTickets(Math.max(1, tickets - 1))} className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded text-gray-700 font-bold transition-colors">-</button>
                <span className="w-6 text-center font-bold text-gray-900">{tickets}</span>
                <button onClick={() => setTickets(tickets + 1)} className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded text-gray-700 font-bold transition-colors">+</button>
              </div>
            </div>
            
            <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-200 text-xl font-black text-gray-900">
              <span>Total Amount</span>
              <span className="text-indigo-600">${total}</span>
            </div>
          </div>
        </div>
        
        {/* Right Side: Secure Payment Mockup */}
        <div className="md:w-1/2 bg-gray-50 p-8">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="h-6 w-6 text-green-500" />
            <h3 className="text-lg font-bold text-gray-900">Secure Payment</h3>
          </div>
          
          <form onSubmit={handlePayment} className="space-y-4">
            {/* Payment Method Selectors */}
            <div className="p-4 bg-white border-2 border-indigo-500 rounded-xl flex items-center gap-3 cursor-pointer shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-indigo-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg">RECOMMENDED</div>
              <div className="h-5 w-5 rounded-full border-4 border-indigo-500 flex items-center justify-center">
                <div className="h-2 w-2 bg-indigo-500 rounded-full"></div>
              </div>
              <div>
                <span className="font-bold text-gray-900 block">Stripe Checkout</span>
                <span className="text-xs text-gray-500 font-medium">Credit, Debit, Apple Pay</span>
              </div>
            </div>
            
            <div className="p-4 bg-white border border-gray-200 rounded-xl flex items-center gap-3 cursor-pointer hover:border-gray-300 transition-colors">
              <div className="h-5 w-5 rounded-full border-2 border-gray-300"></div>
              <div>
                <span className="font-bold text-gray-900 block">Razorpay Checkout</span>
                <span className="text-xs text-gray-500 font-medium">UPI, Netbanking, Cards</span>
              </div>
            </div>

            <div className="pt-6">
              <Button type="submit" variant="primary" className="w-full py-4 text-lg shadow-xl shadow-indigo-600/20" disabled={loading}>
                {loading ? 'Processing Encrypted Payment...' : `Pay $${total} Now`}
              </Button>
              <p className="text-center text-xs text-gray-400 mt-4 flex items-center justify-center gap-1.5 font-medium">
                <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                256-bit SSL Encrypted Payment Gateway
              </p>
            </div>
          </form>
        </div>
        
      </div>
    </div>
  );
};

export default Checkout;
