'use client'

import Link from 'next/link';
import { XCircle } from 'lucide-react';

export default function PaymentCancelledPage() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
        {/* Cancel Icon */}
        <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />

        {/* Title */}
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Payment Cancelled
        </h1>

        {/* Message */}
        <p className="text-gray-600 mb-6">
          Your subscription payment was cancelled. No charges were made.
        </p>

        {/* Info Box */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-yellow-800">
            If you experienced any issues, please contact support or try again.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Link
            href="/"
            className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300"
          >
            Go Back
          </Link>
          <button
            onClick={() => window.history.back()}
            className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
}