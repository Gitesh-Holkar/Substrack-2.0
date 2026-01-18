'use client'

import { useState, useEffect } from 'react';
import { Monitor, Smartphone } from 'lucide-react';

export function MobileBlockModal() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {

    const checkMobile = () => {
      const isMobileDevice = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );
      const isSmallScreen = window.innerWidth < 768;
      setIsMobile(isMobileDevice || isSmallScreen);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (!isMobile) return null;

  const supportEmail = 'support@substrack-yags.vercel.app';  

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900 p-3 sm:p-4 overflow-y-auto">
      <div className="max-w-md w-full bg-white rounded-xl sm:rounded-2xl shadow-2xl p-4 sm:p-6 md:p-8 text-center animate-fade-in my-auto">
        {/* Icon - Responsive sizing */}
        <div className="relative mb-4 sm:mb-6">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-blue-100 rounded-full animate-pulse"></div>
          </div>
          <div className="relative flex items-center justify-center">
            <Monitor className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 text-blue-600 z-10" />
            <div className="absolute -bottom-1 -right-1 sm:-bottom-2 sm:-right-2">
              <div className="relative">
                <Smartphone className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 text-red-500" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-6 h-0.5 sm:w-7 sm:h-0.5 md:w-8 bg-red-500 transform rotate-45"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Title - Responsive sizing */}
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-2 sm:mb-3 px-2">
          Desktop Only Experience
        </h2>

        {/* Message - Responsive sizing */}
        <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6 leading-relaxed px-2">
          <strong>Substrack</strong> is optimized for desktop use to provide the best experience for managing your subscriptions.
        </p>

        

        {/* Desktop Mode Instructions - New */}
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-lg sm:rounded-xl p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="flex items-start gap-2 sm:gap-3 text-left">
            <div className="flex-shrink-0 mt-0.5">
              <Smartphone className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-purple-900 mb-1.5 text-sm sm:text-base">
                💡 Quick Tip: Desktop Mode
              </h3>
              <p className="text-xs sm:text-sm text-purple-800 leading-relaxed">
                Most mobile browsers have a "Desktop Mode" or "Request Desktop Site" option in their settings menu. Enable it to view this site!
              </p>
            </div>
          </div>
        </div>

     

        {/* Support Email Display */}
        <div className="bg-gray-50 rounded-lg p-2 sm:p-3 mb-4 sm:mb-6">
          <p className="text-xs sm:text-sm text-gray-600 mb-1">
            Need help?
          </p>
          <a 
            href={`mailto:${supportEmail}`}
            className="text-xs sm:text-sm font-mono text-blue-600 hover:text-blue-700 break-all"
          >
            {supportEmail}
          </a>
        </div>

        {/* Footer - Responsive */}
        <div className="pt-4 sm:pt-6 border-t border-gray-200">
          <p className="text-xs sm:text-sm text-gray-400">
            📱 Mobile app coming soon!
          </p>
        </div>
      </div>

      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        
        .animate-fade-in {
          animation: fade-in 0.4s ease-out;
        }
      `}</style>
    </div>
  );
}