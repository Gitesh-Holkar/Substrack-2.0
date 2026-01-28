'use client'

import { useSearchParams } from 'next/navigation';
import { Check, ArrowRight } from 'lucide-react';

export default function SubscriptionSuccessPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const merchantName = searchParams.get('merchant');

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
        {/* Success Icon */}
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-green-600" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Subscription Successful!
        </h1>

        {/* Message */}
        <p className="text-gray-600 mb-6">
          Thank you for subscribing to {merchantName ? decodeURIComponent(merchantName) : 'our service'}. Your subscription is now active.
        </p>
        
        {/* Info Box */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-green-800 font-medium mb-2">
            ✅ What happens next?
          </p>
          <ul className="text-sm text-green-700 text-left space-y-1">
            <li>• You&apos;ll receive a confirmation email shortly with attached invoice</li>
            <li>• Your subscription is active immediately</li>
          </ul>
        </div>

        {/* Session ID (if available) */}
        {sessionId && (
          <p className="text-xs text-gray-400 mb-6 font-mono">
            Reference: {sessionId.substring(0, 20)}...
          </p>
        )}
        
        {/* Close Button */}
        <button
          onClick={() => window.close()}
          className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
        >
          Close Window
          <ArrowRight className="w-4 h-4" />
        </button>
        
        <p className="text-xs text-gray-500 mt-4">
          You can safely close this window
        </p>
      </div>
    </div>
  );
}