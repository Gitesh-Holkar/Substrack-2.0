'use client'

import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle } from 'lucide-react';

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get('session_id');

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
        {/* Success Icon */}
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />

        {/* Title */}
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Payment Successful!
        </h1>

        {/* Message */}
        <p className="text-gray-600 mb-6">
          Thank you for subscribing! Your subscription is now active.
        </p>

        {/* Info Box */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-green-800">
            You will receive a confirmation email with your subscription details shortly.
          </p>
        </div>

        {/* Session ID (if available) */}
        {sessionId && (
          <p className="text-sm text-gray-500 mb-6">
            Session ID: <span className="font-mono">{sessionId}</span>
          </p>
        )}

        {/* Return Button */}
        <button
          onClick={() => router.push('/')}
          className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700"
        >
          Return to Homepage
        </button>
      </div>
    </div>
  );
}