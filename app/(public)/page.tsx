'use client'

//LandingPage
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function LandingPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [activeTab, setActiveTab] = useState('plans');

  useEffect(() => {
    // Sticky Header
    const header = document.getElementById('header');
    const onScroll = () => {
      if (window.scrollY > 50) {
        header?.classList.add('is-sticky');
      } else {
        header?.classList.remove('is-sticky');
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // Scroll Reveal
    const revealElements = document.querySelectorAll('.scroll-reveal');
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    revealElements.forEach(el => revealObserver.observe(el));

    // Custom Cursor & Gradient
    if (window.matchMedia("(pointer: fine)").matches) {
      const cursorDot = document.getElementById('cursor-dot');
      const cursorRing = document.getElementById('cursor-ring');
      const cursorTooltip = document.getElementById('cursor-tooltip');
      const gradientBg = document.getElementById('gradient-bg');
      let dotX = 0, dotY = 0, ringX = 0, ringY = 0;

      const handleMouseMove = (e: MouseEvent) => {
        dotX = e.clientX;
        dotY = e.clientY;

        cursorDot && (cursorDot.style.transform = `translate(-50%, -50%) translate(${dotX}px, ${dotY}px)`);
        cursorTooltip && (cursorTooltip.style.transform = `translate(-50%, -250%) translate(${dotX}px, ${dotY}px)`);

        if (gradientBg) {
          gradientBg.style.setProperty('--mouse-x', `${e.clientX}px`);
          gradientBg.style.setProperty('--mouse-y', `${e.clientY}px`);
        }
      };

      window.addEventListener('mousemove', handleMouseMove, { passive: true });

      const followRing = () => {
        ringX += (dotX - ringX) * 0.2;
        ringY += (dotY - ringY) * 0.2;
        cursorRing && (cursorRing.style.transform = `translate(-50%, -50%) translate(${ringX}px, ${ringY}px)`);
        requestAnimationFrame(followRing);
      };
      requestAnimationFrame(followRing);

      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
      };
    }

    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  const handleGetStarted = () => {
    if (user) {
      router.push('/dashboard');
    } else {
      router.push('/signup');
    }
  };

  const handleSignIn = () => {
    router.push('/login');
  };

  return (
    <>
      <style>{`
        html {
          scroll-behavior: smooth;
          cursor: none;
        }

        body {
          font-family: 'Inter', sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          background-color: #030014;
          color: #E2E8F0;
          overflow-x: hidden;
        }

        #gradient-bg {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100vh;
          background: radial-gradient(
            circle at var(--mouse-x, 50%) var(--mouse-y, -100px),
            rgba(79, 70, 229, 0.15) 0%,
            rgba(79, 70, 229, 0) 25%
          );
          z-index: 0;
          transition: background 0.1s ease-out;
          pointer-events: none;
        }

        #cursor-dot, #cursor-ring {
          position: fixed;
          top: 0;
          left: 0;
          transform: translate(-50%, -50%);
          border-radius: 50%;
          pointer-events: none;
          z-index: 9999;
          transition: transform 0.3s cubic-bezier(0.19, 1, 0.22, 1), opacity 0.3s ease;
        }

        #cursor-dot {
          width: 8px;
          height: 8px;
          background-color: #A5B4FC;
        }

        #cursor-ring {
          width: 40px;
          height: 40px;
          border: 2px solid rgba(165, 180, 252, 0.5);
          transition: width 0.3s ease, height 0.3s ease, border-color 0.3s ease, transform 0.1s linear;
        }

        #cursor-tooltip {
          position: fixed;
          top: 0;
          left: 0;
          font-size: 12px;
          font-weight: 500;
          color: #E0E7FF;
          background: #111827;
          border: 1px solid #1E293B;
          border-radius: 6px;
          padding: 4px 8px;
          white-space: nowrap;
          z-index: 9998;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.19, 1, 0.22, 1);
          will-change: opacity, transform;
        }

        body.tooltip-visible #cursor-tooltip {
          opacity: 1;
        }

        body.cursor-hover #cursor-dot {
          transform: translate(-50%, -50%) scale(0.5);
          opacity: 0;
        }

        body.cursor-hover #cursor-ring {
          width: 60px;
          height: 60px;
          border-color: rgba(199, 210, 254, 0.8);
        }

        @media (pointer: coarse) {
          html { cursor: auto; }
          #cursor-dot, #cursor-ring, #cursor-tooltip, #gradient-bg { display: none; }
        }

        #header.is-sticky {
          background-color: rgba(3, 0, 20, 0.8);
          backdrop-filter: blur(10px);
          border-bottom-width: 1px;
          border-color: #1E293B;
        }

        .cta-button {
          position: relative;
          background: #4F46E5;
          color: white;
          z-index: 1;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .cta-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 20px rgba(79, 70, 229, 0.4);
        }

        .scroll-reveal {
          opacity: 0;
          transform: translateY(30px);
          transition: opacity 0.8s cubic-bezier(0.19, 1, 0.22, 1), transform 0.8s cubic-bezier(0.19, 1, 0.22, 1);
          transition-delay: 0.1s;
        }

        .scroll-reveal.is-visible {
          opacity: 1;
          transform: translateY(0);
        }

        .hero-title-anim {
          animation: heroFadeInUp 0.8s cubic-bezier(0.19, 1, 0.22, 1) 0.5s backwards;
        }

        .hero-text-anim {
          animation: heroFadeInUp 0.8s cubic-bezier(0.19, 1, 0.22, 1) 0.7s backwards;
        }

        .hero-button-anim {
          animation: heroFadeInUp 0.8s cubic-bezier(0.19, 1, 0.22, 1) 0.9s backwards;
        }

        @keyframes heroFadeInUp {
          0% { opacity: 0; transform: translateY(30px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        .hero-visual {
          transform-style: preserve-3d;
          perspective: 1000px;
          animation-name: float, heroFadeInUp;
          animation-duration: 6s, 0.8s;
          animation-timing-function: ease-in-out, cubic-bezier(0.19, 1, 0.22, 1);
          animation-delay: 0s, 1.1s;
          animation-iteration-count: infinite, 1;
          animation-fill-mode: forwards, backwards;
        }

        .dashboard-mock {
          transform: rotateX(10deg) rotateY(-8deg) scale(0.9);
          box-shadow: 0 40px 80px -20px rgba(0, 0, 0, 0.2);
          transition: all 0.6s ease;
        }

        .dashboard-mock:hover {
          transform: rotateX(2deg) rotateY(-1deg) scale(0.95);
          box-shadow: 0 50px 90px -20px rgba(0, 0, 0, 0.25);
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }

        .hero-anim-1 { animation: popIn 0.5s ease-out 0.2s backwards; }
        .hero-anim-2 { animation: popIn 0.5s ease-out 0.4s backwards; }
        .hero-anim-3 { animation: popIn 0.5s ease-out 0.6s backwards; }
        .hero-anim-4 { animation: slideInUp 0.5s ease-out 0.8s backwards; }
        
        .hero-anim-graph {
          stroke-dasharray: 1000;
          stroke-dashoffset: 1000;
          animation: draw-graph 1.5s ease-out 1s forwards;
        }

        @keyframes popIn {
          0% { opacity: 0; transform: scale(0.8); }
          100% { opacity: 1; transform: scale(1); }
        }

        @keyframes slideInUp {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        @keyframes draw-graph {
          0% { stroke-dashoffset: 1000; }
          100% { stroke-dashoffset: 0; }
        }

        .before-after-card {
          background: #111827;
          border: 1px solid #1E293B;
          border-radius: 12px;
          padding: 1.5rem;
          transition: transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
        }

        .before-card:hover {
          transform: translateY(-5px);
          border-color: #F87171;
          box-shadow: 0 10px 25px -5px rgba(248, 113, 113, 0.1);
        }

        .after-card:hover {
          transform: translateY(-5px);
          border-color: #4ADE80;
          box-shadow: 0 10px 25px -5px rgba(74, 222, 128, 0.1);
        }

        .dashboard-tabs button {
          transition: background-color 0.3s ease, color 0.3s ease;
        }

        .dashboard-tabs button.active {
          background-color: #4F46E5 !important;
          color: #FFF !important;
        }

        .dashboard-content-pane {
          display: none;
          opacity: 0;
          animation: fadeIn 0.5s ease-out forwards;
        }

        .dashboard-content-pane.active {
          display: block;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .timeline-container {
          position: relative;
          max-width: 4xl;
          margin: 0 auto;
        }

        .timeline-line {
          position: absolute;
          left: 50%;
          top: 0;
          bottom: 0;
          width: 2px;
          background: #374151;
          transform: translateX(-1px);
        }

        .timeline-item {
          position: relative;
          width: 50%;
          padding: 1rem 2rem;
        }

        .timeline-item:nth-child(odd) {
          left: 0;
          padding-right: 4rem;
          text-align: right;
        }

        .timeline-item:nth-child(even) {
          left: 50%;
          padding-left: 4rem;
          text-align: left;
        }

        .timeline-dot {
          position: absolute;
          top: 1.25rem;
          width: 16px;
          height: 16px;
          background: #4F46E5;
          border: 3px solid #030014;
          border-radius: 50%;
          z-index: 5;
        }

        .timeline-item:nth-child(odd) .timeline-dot {
          right: -8px;
        }

        .timeline-item:nth-child(even) .timeline-dot {
          left: -8px;
        }

        .feature-card {
          background: #111827;
          border: 1px solid #1E293B;
          border-radius: 16px;
          padding: 2rem;
          position: relative;
          overflow: hidden;
          transition: transform 0.3s ease, border-color 0.3s ease;
        }

        .feature-card:hover {
          transform: translateY(-5px);
          border-color: #4F46E5;
        }

        .testimonial-card {
          background: #111827;
          border: 1px solid #1E293B;
        }

        @media (max-width: 768px) {
          .dashboard-mock {
            transform: rotateX(0) rotateY(0) scale(1);
          }
          .timeline-line { left: 1rem; }
          .timeline-item { width: 100%; padding-left: 3rem; text-align: left !important; }
          .timeline-item:nth-child(odd) { left: 0; }
          .timeline-item:nth-child(even) { left: 0; }
          .timeline-dot { left: calc(1rem - 7px) !important; right: auto !important; }
        }
      `}</style>

      <div className="text-gray-300">
        <div id="gradient-bg"></div>
        <div id="cursor-dot"></div>
        <div id="cursor-ring"></div>
        <div id="cursor-tooltip">Subscription Management System</div>

        <header id="header" className="fixed top-0 left-0 w-full z-50 transition-all duration-300">
          <nav className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <a href="/" id="header-logo" className="flex items-center space-x-2 z-10">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span className="text-2xl font-bold text-white">Substrack</span>
            </a>

            <div className="hidden md:flex items-center space-x-6 z-10">
              <a href="#demo" className="text-gray-300 hover:text-white transition-colors">Demo</a>
              <a href="#story" className="text-gray-300 hover:text-white transition-colors">Story</a>
              <a href="#features" className="text-gray-300 hover:text-white transition-colors">Features</a>
              <a href="#testimonials" className="text-gray-300 hover:text-white transition-colors">Feedback</a>
            </div>

            <div className="hidden md:flex items-center space-x-3 z-10">
              <button onClick={handleSignIn} className="text-sm font-medium text-gray-300 hover:text-white transition-colors">
                Sign In
              </button>
              <button onClick={handleGetStarted} className="cta-button px-5 py-2.5 text-sm font-medium rounded-lg shadow-md transition-all">
                Get Started Free
              </button>
            </div>

            <button onClick={() => setShowMobileMenu(!showMobileMenu)} className="md:hidden text-gray-300 hover:text-white z-10">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </nav>

          {showMobileMenu && (
            <div className="md:hidden bg-gray-900 shadow-lg">
              <a href="#demo" className="block px-6 py-3 text-gray-300 hover:bg-gray-800">Demo</a>
              <a href="#story" className="block px-6 py-3 text-gray-300 hover:bg-gray-800">Story</a>
              <a href="#features" className="block px-6 py-3 text-gray-300 hover:bg-gray-800">Features</a>
              <a href="#testimonials" className="block px-6 py-3 text-gray-300 hover:bg-gray-800">Feedback</a>
              <div className="border-t border-gray-700 px-6 py-4 space-y-3">
                <button onClick={handleSignIn} className="block text-center w-full px-5 py-2.5 text-sm font-medium text-indigo-400 border border-indigo-400 rounded-lg hover:bg-gray-800 transition-colors">
                  Sign In
                </button>
                <button onClick={handleGetStarted} className="block text-center w-full px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg shadow-md hover:bg-indigo-700 transition-all">
                  Get Started Free
                </button>
              </div>
            </div>
          )}
        </header>

        <main className="relative z-10">
          {/* Hero Section */}
          <section id="hero-section" className="relative pt-40 pb-20 md:pt-56 md:pb-32 overflow-hidden">
            <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              <div className="hero-text-content text-center md:text-left h-48 md:h-auto">
                <h1 className="hero-title-anim text-4xl md:text-5xl lg:text-6xl font-extrabold text-white leading-tight">
                  Stop chasing payments.
                  <br className="hidden lg:inline" />
                  <span className="text-indigo-400">Start growing.</span>
                </h1>
                <p className="hero-text-anim mt-6 text-lg md:text-xl text-gray-300 max-w-xl mx-auto md:mx-0">
                  The all-in-one platform for SMBs to automate billing, reduce churn, and effortlessly grow recurring revenue.
                </p>
                <div className="hero-button-anim mt-10 flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                  <button onClick={handleGetStarted} className="cta-button inline-block px-8 py-4 text-lg font-medium rounded-lg shadow-lg transition-all transform hover:scale-105">
                    Get Started for Free
                  </button>
                </div>
              </div>

              <div className="hero-visual">
                <div className="dashboard-mock w-full bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
                  <div className="h-10 bg-gray-100 border-b border-gray-200 flex items-center px-4 space-x-2">
                    <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                    <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                    <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                    <div className="flex-1 text-center text-sm text-gray-500 bg-white rounded-md py-1 px-4">substrack-yags.vercel.app/dashboard</div>
                  </div>

                  <div className="p-4 md:p-6 grid grid-cols-3 gap-4 text-gray-800">
                    <div className="hero-anim-1 col-span-3 sm:col-span-1 bg-white p-4 rounded-lg shadow-md border border-gray-100">
                      <span className="text-xs text-gray-500">Total Revenue</span>
                      <p className="text-2xl font-bold">₹42,850</p>
                      <span className="text-xs text-green-500 flex items-center">
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                        +12.5%
                      </span>
                    </div>
                    <div className="hero-anim-2 col-span-3 sm:col-span-1 bg-white p-4 rounded-lg shadow-md border border-gray-100">
                      <span className="text-xs text-gray-500">Active Subscribers</span>
                      <p className="text-2xl font-bold">1,204</p>
                      <span className="text-xs text-green-500 flex items-center">
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                        +52 new
                      </span>
                    </div>
                    <div className="hero-anim-3 col-span-3 sm:col-span-1 bg-white p-4 rounded-lg shadow-md border border-gray-100">
                      <span className="text-xs text-gray-500">Churn Rate</span>
                      <p className="text-2xl font-bold">2.1%</p>
                      <span className="text-xs text-red-500 flex items-center">
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17l-5-5m0 0l5-5m-5 5h18" /></svg>
                        -0.5%
                      </span>
                    </div>
                    <div className="hero-anim-4 col-span-3 bg-gray-50 p-4 rounded-lg border border-gray-100">
                      <span className="text-sm font-medium text-gray-700">Revenue Growth</span>
                      <svg className="w-full h-24 mt-2" viewBox="0 0 300 100" preserveAspectRatio="none">
                        <path d="M 0 80 Q 50 20, 100 60 T 200 40 T 300 20" stroke="#4f46e5" strokeWidth="3" fill="none" className="hero-anim-graph" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Problem Section */}
          <section className="py-20 md:py-32 bg-transparent">
            <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center">
              <span className="text-sm font-bold uppercase text-indigo-400 tracking-wider scroll-reveal">The Problem</span>
              <h2 className="mt-3 text-3xl md:text-4xl font-extrabold text-white scroll-reveal">Subscription billing is manual chaos.</h2>
              <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="before-after-card before-card scroll-reveal">
                  <h3 className="text-2xl font-semibold text-white">Before Substrack</h3>
                  <ul className="mt-4 space-y-2 text-left text-gray-400">
                    <li className="flex items-center"><span className="text-red-400 mr-3">✗</span>Manually send 50 invoices</li>
                    <li className="flex items-center"><span className="text-red-400 mr-3">✗</span>Chase 5 failed payments</li>
                    <li className="flex items-center"><span className="text-red-400 mr-3">✗</span>Email card expiry reminders</li>
                    <li className="flex items-center"><span className="text-red-400 mr-3">✗</span>Calculate GST in a spreadsheet</li>
                  </ul>
                </div>
                <div className="before-after-card after-card scroll-reveal" style={{transitionDelay: '0.2s'}}>
                  <h3 className="text-2xl font-semibold text-white">After Substrack</h3>
                  <ul className="mt-4 space-y-2 text-left text-gray-300">
                    <li className="flex items-center"><span className="text-green-400 mr-3">✓</span>50 invoices automated</li>
                    <li className="flex items-center"><span className="text-green-400 mr-3">✓</span>5 payments retried & captured</li>
                    <li className="flex items-center"><span className="text-green-400 mr-3">✓</span>Dunning emails sent</li>
                    <li className="flex items-center"><span className="text-green-400 mr-3">✓</span>GST calculated automatically</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Interactive Dashboard Section */}
          <section id="demo" className="py-20 md:py-32">
            <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="text-center">
                <span className="text-sm font-bold uppercase text-indigo-400 tracking-wider scroll-reveal">The Solution</span>
                <h2 className="mt-3 text-3xl md:text-4xl font-extrabold text-white scroll-reveal">An Interactive Look Inside.</h2>
                <p className="mt-5 text-lg text-gray-300 max-w-3xl mx-auto scroll-reveal">
                  Click the tabs to see how Substrack organizes your entire business.
                </p>
              </div>

              <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-16 items-start">
                <div className="dashboard-tabs flex md:flex-col gap-2 scroll-reveal" style={{transitionDelay: '0.2s'}}>
                  <button 
                    className={`tab-button w-full text-left px-6 py-4 rounded-lg ${activeTab === 'plans' ? 'active bg-indigo-600 text-white' : 'bg-gray-800/50 text-gray-400'}`}
                    onClick={() => setActiveTab('plans')}
                  >
                    <h4 className="text-lg font-semibold text-white">Create Plans</h4>
                    <p className="text-sm text-gray-400">Build your subscription packages.</p>
                  </button>
                  <button 
                    className={`tab-button w-full text-left px-6 py-4 rounded-lg ${activeTab === 'subscribers' ? 'active bg-indigo-600 text-white' : 'bg-gray-800/50 text-gray-400'}`}
                    onClick={() => setActiveTab('subscribers')}
                  >
                    <h4 className="text-lg font-semibold text-white">Manage Subscribers</h4>
                    <p className="text-sm text-gray-400">See all your customers in one place.</p>
                  </button>
                  <button 
                    className={`tab-button w-full text-left px-6 py-4 rounded-lg ${activeTab === 'analytics' ? 'active bg-indigo-600 text-white' : 'bg-gray-800/50 text-gray-400'}`}
                    onClick={() => setActiveTab('analytics')}
                  >
                    <h4 className="text-lg font-semibold text-white">Track Analytics</h4>
                    <p className="text-sm text-gray-400">Watch your MRR and growth.</p>
                  </button>
                </div>

                <div className="md:col-span-2 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl h-full min-h-[400px] scroll-reveal" style={{transitionDelay: '0.4s'}}>
                  <div className="h-10 bg-gray-800 border-b border-gray-700 flex items-center px-4 space-x-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  </div>
                  <div className="p-6">
                    <div className={`dashboard-content-pane ${activeTab === 'plans' ? 'active' : ''}`}>
                      <h3 className="text-xl font-semibold text-white">Subscription Plans</h3>
                      <div className="mt-4 space-y-3">
                        <div className="p-4 bg-gray-800 rounded-lg flex justify-between items-center">
                          <div>
                            <h5 className="font-semibold text-white">Pro Plan</h5>
                            <p className="text-sm text-gray-400">₹999 / month</p>
                          </div>
                          <span className="px-3 py-1 text-xs text-green-300 bg-green-900/50 rounded-full">Active</span>
                        </div>
                        <div className="p-4 bg-gray-800 rounded-lg flex justify-between items-center">
                          <div>
                            <h5 className="font-semibold text-white">Basic Plan</h5>
                            <p className="text-sm text-gray-400">₹499 / month</p>
                          </div>
                          <span className="px-3 py-1 text-xs text-green-300 bg-green-900/50 rounded-full">Active</span>
                        </div>
                      </div>
                    </div>

                    <div className={`dashboard-content-pane ${activeTab === 'subscribers' ? 'active' : ''}`}>
                      <h3 className="text-xl font-semibold text-white">Subscribers (1,204)</h3>
                      <div className="mt-4 space-y-3">
                        <div className="p-4 bg-gray-800 rounded-lg flex justify-between items-center">
                          <div>
                            <h5 className="font-semibold text-white">Rohan Kumar</h5>
                            <p className="text-sm text-gray-400">rohan@example.com</p>
                          </div>
                          <span className="px-3 py-1 text-xs text-indigo-300 bg-indigo-900/50 rounded-full">Pro Plan</span>
                        </div>
                        <div className="p-4 bg-gray-800 rounded-lg flex justify-between items-center">
                          <div>
                            <h5 className="font-semibold text-white">Priya Sharma</h5>
                            <p className="text-sm text-gray-400">priya@example.com</p>
                          </div>
                          <span className="px-3 py-1 text-xs text-red-300 bg-red-900/50 rounded-full">Payment Failed</span>
                        </div>
                      </div>
                    </div>

                    <div className={`dashboard-content-pane ${activeTab === 'analytics' ? 'active' : ''}`}>
                      <h3 className="text-xl font-semibold text-white">Monthly Recurring Revenue (MRR)</h3>
                      <p className="text-3xl font-bold text-green-400 mt-2">₹1,42,850</p>
                      <svg className="w-full h-40 mt-4" viewBox="0 0 300 100" preserveAspectRatio="none">
                        <path d="M 0 80 Q 50 20, 100 60 T 200 40 T 300 20" stroke="#4f46e5" strokeWidth="3" fill="none" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Timeline Story Section */}
          <section id="story" className="py-20 md:py-32">
            <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="text-center max-w-3xl mx-auto">
                <span className="text-sm font-bold uppercase text-indigo-400 tracking-wider scroll-reveal">The Story</span>
                <h2 className="mt-3 text-3xl md:text-4xl font-extrabold text-white scroll-reveal">Follow a subscription from start to finish.</h2>
              </div>

              <div className="timeline-container mt-20">
                <div className="timeline-line"></div>
                <div className="timeline-item scroll-reveal">
                  <div className="timeline-dot"></div>
                  <h3 className="text-xl font-semibold text-white">Day 1: New Subscriber</h3>
                  <p className="mt-2 text-gray-400">Rohan signs up for your "Pro Plan." Substrack securely saves his details and starts his subscription instantly.</p>
                </div>
                <div className="timeline-item scroll-reveal">
                  <div className="timeline-dot"></div>
                  <h3 className="text-xl font-semibold text-white">Day 30: Automatic Billing</h3>
                  <p className="mt-2 text-gray-400">The first renewal is due. Substrack automatically charges Rohan's card and sends a GST-compliant invoice. No manual work.</p>
                </div>
                <div className="timeline-item scroll-reveal">
                  <div className="timeline-dot"></div>
                  <h3 className="text-xl font-semibold text-white">Day 180: Smart Dunning</h3>
                  <p className="mt-2 text-gray-400">Rohan's card is expiring. Substrack automatically sends a "Smart Dunning" email prompting him to update his card, *before* it fails.</p>
                </div>
                <div className="timeline-item scroll-reveal">
                  <div className="timeline-dot"></div>
                  <h3 className="text-xl font-semibold text-white">Day 181: Revenue Saved</h3>
                  <p className="mt-2 text-gray-400">He updates his card. The payment succeeds. You just saved a customer and prevented involuntary churn without lifting a finger.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Features Section */}
          <section id="features" className="py-20 md:py-32">
            <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="text-center">
                <span className="text-sm font-bold uppercase text-indigo-400 tracking-wider scroll-reveal">All-In-One</span>
                <h2 className="mt-3 text-3xl md:text-4xl font-extrabold text-white scroll-reveal">Your Complete Growth Toolkit.</h2>
              </div>
              <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <div className="feature-card scroll-reveal">
                  <h3 className="text-2xl font-semibold text-white">Automated Billing</h3>
                  <p className="mt-2 text-gray-300">Charge customers automatically. We handle GST, generate invoices, and send receipts.</p>
                </div>
                <div className="feature-card scroll-reveal" style={{transitionDelay: '0.1s'}}>
                  <h3 className="text-2xl font-semibold text-white">Subscriber Management</h3>
                  <p className="mt-2 text-gray-300">One dashboard to see all your subscribers. Manually add, cancel, or upgrade plans.</p>
                </div>
                <div className="feature-card scroll-reveal" style={{transitionDelay: '0.2s'}}>
                  <h3 className="text-2xl font-semibold text-white">Smart Dunning</h3>
                  <p className="mt-2 text-gray-300">Automatically retry failed payments and email customers to reduce churn.</p>
                </div>
                <div className="feature-card scroll-reveal" style={{transitionDelay: '0.3s'}}>
                  <h3 className="text-2xl font-semibold text-white">Powerful Analytics</h3>
                  <p className="mt-2 text-gray-300">Simple, clear metrics like MRR, Churn, and LTV. No spreadsheets needed.</p>
                </div>
                <div className="feature-card scroll-reveal" style={{transitionDelay: '0.4s'}}>
                  <h3 className="text-2xl font-semibold text-white">Hosted Checkout</h3>
                  <p className="mt-2 text-gray-300">Integrate a secure checkout page on your site. No complex coding required.</p>
                </div>
                <div className="feature-card scroll-reveal" style={{transitionDelay: '0.5s'}}>
                  <h3 className="text-2xl font-semibold text-white">Developer APIs</h3>
                  <p className="mt-2 text-gray-300">Integrate Substrack directly into your app with our simple, powerful REST API.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Testimonials Section */}
          <section id="testimonials" className="py-20 md:py-32">
            <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
              <div className="text-center">
                <h2 className="text-3xl md:text-4xl font-extrabold text-white">Loved by businesses like yours.</h2>
              </div>
              <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="scroll-reveal testimonial-card p-8 rounded-xl shadow-lg">
                  <svg className="w-10 h-10 text-indigo-400" fill="currentColor" viewBox="0 0 32 32">
                    <path d="M9.333 7C4.178 7 0 11.178 0 16.333 0 21.488 4.178 25.667 9.333 25.667 14.488 25.667 18.667 21.488 18.667 16.333L18.667 7 9.333 7zM28 7C22.845 7 18.667 11.178 18.667 16.333 18.667 21.488 22.845 25.667 28 25.667 33.155 25.667 37.333 21.488 37.333 16.333L37.333 7 28 7z" transform="scale(0.8)" />
                  </svg>
                  <p className="mt-6 text-lg text-gray-300">
                    "Substrack saved us. We cut our involuntary churn by 50% in the first month. The dunning feature alone is worth 10x the price."
                  </p>
                  <div className="mt-6 flex items-center space-x-4">
                    <img src="https://placehold.co/48x48/3730A3/E0E7FF?text=S" className="w-12 h-12 rounded-full" alt="Sarah K." />
                    <div>
                      <p className="font-semibold text-white">Sarah K.</p>
                      <p className="text-sm text-gray-400">Founder, DesignJoy SaaS</p>
                    </div>
                  </div>
                </div>
                <div className="scroll-reveal testimonial-card p-8 rounded-xl shadow-lg" style={{transitionDelay: '200ms'}}>
                  <svg className="w-10 h-10 text-indigo-400" fill="currentColor" viewBox="0 0 32 32">
                    <path d="M9.333 7C4.178 7 0 11.178 0 16.333 0 21.488 4.178 25.667 9.333 25.667 14.488 25.667 18.667 21.488 18.667 16.333L18.667 7 9.333 7zM28 7C22.845 7 18.667 11.178 18.667 16.333 18.667 21.488 22.845 25.667 28 25.667 33.155 25.667 37.333 21.488 37.333 16.333L37.333 7 28 7z" transform="scale(0.8)" />
                  </svg>
                  <p className="mt-6 text-lg text-gray-300">
                    "As a non-technical founder, I needed a simple way to set up billing. Substrack's dashboard is incredibly intuitive. I was set up and taking payments in 20 minutes."
                  </p>
                  <div className="mt-6 flex items-center space-x-4">
                    <img src="https://placehold.co/48x48/3730A3/E0E7FF?text=M" className="w-12 h-12 rounded-full" alt="Mike R." />
                    <div>
                      <p className="font-semibold text-white">Mike R.</p>
                      <p className="text-sm text-gray-400">Owner, CopyAI Weekly</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Final CTA Section */}
          <section className="bg-indigo-700">
            <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-20 md:py-32 text-center">
              <h2 className="text-3xl md:text-5xl font-extrabold text-white">
                Stop Leaking Revenue. Start Growing.
              </h2>
              <button onClick={handleGetStarted} className="cta-button mt-10 inline-block px-10 py-5 text-xl font-medium rounded-lg shadow-xl transition-all transform hover:scale-105">
                Start Your Free Trial Today
              </button>
              <p className="mt-4 text-sm text-indigo-200">No credit card required · Cancel anytime</p>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="bg-gray-900 text-gray-400">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
              <div className="col-span-2 lg:col-span-2">
                <a href="/" className="flex items-center space-x-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <span className="text-2xl font-bold text-white">Substrack</span>
                </a>
                <p className="mt-4 text-sm max-w-xs">The easiest way for small businesses to manage recurring billing.</p>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">Product</h4>
                <ul className="mt-4 space-y-3">
                  <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">Company</h4>
                <ul className="mt-4 space-y-3">
                  <li><a href="#" className="hover:text-white transition-colors">About Us</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">Legal</h4>
                <ul className="mt-4 space-y-3">
                  <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
                </ul>
              </div>
            </div>

            <div className="mt-12 pt-8 border-t border-gray-700 text-sm text-center">
              <p>&copy; 2024 Substrack. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
