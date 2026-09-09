import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { Bug, X, Upload, CheckCircle2, AlertCircle, Info, Image as ImageIcon, AlertTriangle } from 'lucide-react';
import { sendBugReportEmail } from '../utils/emailService';

// In-memory capture for recent uncaught runtime errors
let lastCaughtError = null;

// Global error hook (runs once)
if (typeof window !== 'undefined' && !window.__errorHookAttached) {
  window.__errorHookAttached = true;

  window.addEventListener('error', (event) => {
    const err = `${event.message} at ${event.filename}:${event.lineno}:${event.colno}`;
    lastCaughtError = err;
    window.dispatchEvent(new CustomEvent('app-error', { detail: err }));
  });

  window.addEventListener('unhandledrejection', (event) => {
    const err = `Unhandled Promise Rejection: ${event.reason?.message || event.reason}`;
    lastCaughtError = err;
    window.dispatchEvent(new CustomEvent('app-error', { detail: err }));
  });

  const originalConsoleError = console.error;
  console.error = (...args) => {
    originalConsoleError.apply(console, args);
    const msg = args.map(a => (typeof a === 'object' ? (a?.message || JSON.stringify(a)) : String(a))).join(' ');
    lastCaughtError = msg;
    window.dispatchEvent(new CustomEvent('app-error', { detail: msg }));
  };
}

export default function BugReportModal() {
  const { currentUser, userProfile } = useAuth();

  // Hidden by default; shown only when an error occurs
  const [isVisible, setIsVisible] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [screenshot, setScreenshot] = useState(null);
  const [screenshotPreview, setScreenshotPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Custom non-alert success popup
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);

  // Metadata to trace
  const [metaInfo, setMetaInfo] = useState({});

  const timerRef = useRef(null);

  // Reset or start the 1-minute (60s) countdown timer
  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      // Only hide if the user hasn't kept the modal open
      setIsVisible((currentVisible) => {
        setIsOpen((currentOpen) => {
          if (!currentOpen) {
            return false;
          }
          return currentOpen;
        });
        return false;
      });
    }, 60000); // 1 minute
  }, []);

  // Listen for errors
  useEffect(() => {
    function onErrorTriggered(e) {
      const errorDetail = e.detail || 'An unexpected error was detected.';
      lastCaughtError = errorDetail;
      setIsVisible(true);
      resetTimer();
    }

    window.addEventListener('app-error', onErrorTriggered);
    return () => {
      window.removeEventListener('app-error', onErrorTriggered);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [resetTimer]);

  useEffect(() => {
    if (isOpen) {
      setMetaInfo({
        pageUrl: window.location.href,
        route: window.location.hash || window.location.pathname,
        timeReported: new Date().toLocaleString(),
        isoTime: new Date().toISOString(),
        userName: userProfile?.name || 'Anonymous User',
        userEmail: currentUser?.email || 'None (Logged out)',
        family: userProfile?.familyId || 'N/A',
        role: userProfile?.isMaster ? 'Master Admin' : userProfile?.isAdmin ? 'Family Admin' : 'Member',
        browser: navigator.userAgent,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        runtimeError: lastCaughtError || 'None detected'
      });
      setErrorMessage('');
    }
  }, [isOpen, currentUser, userProfile]);

  // Handle Screenshot Upload with client-side compression
  function handleImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please upload a valid image file (PNG, JPG, etc.).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Compress image using canvas so it saves smoothly in Firestore and transfers easily
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);

        setScreenshot(compressedDataUrl);
        setScreenshotPreview(compressedDataUrl);
        setErrorMessage('');
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }

  function handleRemoveScreenshot() {
    setScreenshot(null);
    setScreenshotPreview(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!description.trim()) {
      setErrorMessage('Please describe the issue you encountered.');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    try {
      // 1. Locate Master Admin email
      let masterAdminEmail = null;
      try {
        const q = query(collection(db, 'users'), where('isMaster', '==', true));
        const masterSnap = await getDocs(q);
        if (!masterSnap.empty) {
          masterAdminEmail = masterSnap.docs[0].data().email;
        } else {
          // Fallback check
          const q2 = query(collection(db, 'users'), where('role', '==', 'master'));
          const snap2 = await getDocs(q2);
          if (!snap2.empty) masterAdminEmail = snap2.docs[0].data().email;
        }
      } catch (err) {
        console.warn("Could not query master admin doc:", err);
      }

      // 2. Persist Bug Report to Firestore collection `bug_reports`
      await addDoc(collection(db, 'bug_reports'), {
        issue: description.trim(),
        reporterEmail: currentUser?.email || 'Anonymous',
        reporterName: userProfile?.name || 'Anonymous',
        familyId: userProfile?.familyId || 'N/A',
        pageUrl: metaInfo.pageUrl,
        route: metaInfo.route,
        timeReported: metaInfo.timeReported,
        isoTime: metaInfo.isoTime,
        metadata: {
          browser: metaInfo.browser,
          viewport: metaInfo.viewport,
          userRole: metaInfo.role,
          lastError: metaInfo.runtimeError
        },
        screenshot: screenshot || null,
        status: 'open',
        createdAt: Date.now()
      });

      // 3. Send email to Master Admin via EmailJS if email found
      if (masterAdminEmail) {
        await sendBugReportEmail({
          masterEmail: masterAdminEmail,
          reporterName: userProfile?.name || currentUser?.email || 'Christmas Shopping List User',
          reporterEmail: currentUser?.email || '',
          issueDescription: description.trim(),
          pageUrl: metaInfo.pageUrl,
          timestamp: metaInfo.timeReported,
          metadata: {
            browser: metaInfo.browser,
            viewport: metaInfo.viewport,
            lastError: metaInfo.runtimeError
          }
        });
      }

      // 4. Show custom non-alert success popup!
      setDescription('');
      setScreenshot(null);
      setScreenshotPreview(null);
      setShowSuccessPopup(true);
    } catch (err) {
      console.error("Failed to submit bug report:", err);
      setErrorMessage("Failed to submit report: " + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleDismissSuccess() {
    setShowSuccessPopup(false);
    setIsOpen(false);
    setIsVisible(false); // Hide the bug report button immediately upon clicking OK
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  }

  function handleCloseModal() {
    setIsOpen(false);
    resetTimer(); // Resume the 1-minute countdown
  }

  return (
    <>
      {/* Pull-out Style Tab on the Edge of Screen - HIDDEN by default; only shown when an error occurs */}
      {isVisible && (
        <button
          onClick={() => {
            setIsOpen(true);
            resetTimer();
          }}
          onMouseEnter={resetTimer}
          aria-label="Report a bug"
          style={{
            position: 'fixed',
            top: '45%',
            right: 0,
            transform: 'translateY(-50%)',
            zIndex: 9990,
            background: 'linear-gradient(135deg, #ef4444, #dc2626)',
            color: 'white',
            border: 'none',
            borderTopLeftRadius: '14px',
            borderBottomLeftRadius: '14px',
            padding: '0.75rem 0.6rem 0.75rem 0.8rem',
            boxShadow: '-4px 4px 20px rgba(239, 68, 68, 0.45)',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.4rem',
            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            fontFamily: 'inherit'
          }}
          onMouseEnter={(e) => {
            resetTimer();
            e.currentTarget.style.paddingRight = '1rem';
            e.currentTarget.style.boxShadow = '-6px 6px 25px rgba(239, 68, 68, 0.6)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.paddingRight = '0.6rem';
            e.currentTarget.style.boxShadow = '-4px 4px 20px rgba(239, 68, 68, 0.45)';
          }}
          title="Issue detected! Click to report to Master Admin (auto-hides in 1 min if inactive)"
        >
          <Bug size={22} color="#ffffff" style={{ animation: 'pulse 1.5s infinite' }} />
          <span 
            style={{ 
              writingMode: 'vertical-rl', 
              textOrientation: 'mixed', 
              fontSize: '0.75rem', 
              fontWeight: '700', 
              letterSpacing: '1px',
              textTransform: 'uppercase'
            }}
          >
            Report Bug
          </span>
        </button>
      )}

      {/* Bug Report Modal Backdrop & Window */}
      {isOpen && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 9995,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            overflowY: 'auto'
          }}
          onMouseMove={resetTimer}
          onKeyDown={resetTimer}
          onClick={(e) => {
            resetTimer();
            if (e.target === e.currentTarget && !submitting) handleCloseModal();
          }}
        >
          <div 
            className="glass-card" 
            onMouseMove={resetTimer}
            onClick={resetTimer}
            style={{
              maxWidth: '560px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              position: 'relative',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.7)',
              padding: '1.75rem'
            }}
          >
            {/* Close Button */}
            <button 
              onClick={handleCloseModal}
              disabled={submitting}
              style={{
                position: 'absolute',
                top: '1.25rem',
                right: '1.25rem',
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                color: 'white',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X size={18} />
            </button>

            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div 
                style={{
                  background: 'rgba(239, 68, 68, 0.2)',
                  borderRadius: '12px',
                  padding: '0.6rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Bug size={24} color="#ef4444" />
              </div>
              <div>
                <h2 style={{ fontSize: '1.4rem', margin: 0 }}>Report an Issue</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                  Direct notification to Master Admin with system trace data
                </p>
              </div>
            </div>

            {errorMessage && (
              <div 
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid #ef4444',
                  color: '#f87171',
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  fontSize: '0.9rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <AlertCircle size={18} /> {errorMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Issue Description */}
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                  What went wrong? <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what happened, what you expected to see, or any unexpected buttons/errors..."
                  required
                  style={{
                    width: '100%',
                    padding: '0.85rem',
                    borderRadius: '10px',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    background: 'rgba(0, 0, 0, 0.35)',
                    color: 'white',
                    fontSize: '0.95rem',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Optional Screenshot Upload */}
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                  Attach Screenshot (Optional)
                </label>

                {!screenshotPreview ? (
                  <label 
                    style={{
                      border: '2px dashed rgba(255, 255, 255, 0.2)',
                      borderRadius: '12px',
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      cursor: 'pointer',
                      background: 'rgba(255, 255, 255, 0.03)',
                      transition: 'border-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'}
                  >
                    <Upload size={22} color="var(--text-muted)" />
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Click to upload screenshot (PNG, JPG)
                    </span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageChange} 
                      style={{ display: 'none' }} 
                    />
                  </label>
                ) : (
                  <div 
                    style={{
                      position: 'relative',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      background: 'rgba(0, 0, 0, 0.5)',
                      padding: '0.5rem'
                    }}
                  >
                    <img 
                      src={screenshotPreview} 
                      alt="Bug Screenshot Preview" 
                      style={{ width: '100%', maxHeight: '200px', objectFit: 'contain', borderRadius: '8px' }} 
                    />
                    <button
                      type="button"
                      onClick={handleRemoveScreenshot}
                      style={{
                        position: 'absolute',
                        top: '0.75rem',
                        right: '0.75rem',
                        background: 'rgba(239, 68, 68, 0.85)',
                        border: 'none',
                        color: 'white',
                        padding: '0.35rem 0.6rem',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem'
                      }}
                    >
                      <X size={14} /> Remove Image
                    </button>
                  </div>
                )}
              </div>

              {/* Automatic Metadata Preview */}
              <div 
                style={{
                  background: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  padding: '0.75rem 1rem',
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem', color: '#cbd5e1', fontWeight: 'bold' }}>
                  <Info size={14} color="#60a5fa" /> System Trace Included Automatically:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.25rem 0.75rem' }}>
                  <div><strong>Time:</strong> {metaInfo.timeReported}</div>
                  <div><strong>User:</strong> {metaInfo.userEmail}</div>
                  <div><strong>Page:</strong> {metaInfo.route}</div>
                  <div><strong>Resolution:</strong> {metaInfo.viewport}</div>
                  {metaInfo.runtimeError !== 'None detected' && (
                    <div style={{ color: '#f87171', gridColumn: '1 / -1' }}>
                      <strong>Detected Error:</strong> {metaInfo.runtimeError}
                    </div>
                  )}
                </div>
              </div>

              {/* Form Action Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={submitting}
                  className="btn"
                  style={{ background: 'rgba(255, 255, 255, 0.1)', color: 'white' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary"
                  style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)' }}
                >
                  {submitting ? 'Notifying Master Admin...' : 'Send Bug Report'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Custom Success Popup Modal (Rule: Do NOT use default alert()) */}
      {showSuccessPopup && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem'
          }}
        >
          <div 
            className="glass-card" 
            style={{
              maxWidth: '440px',
              width: '100%',
              textAlign: 'center',
              padding: '2.25rem 2rem',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              boxShadow: '0 25px 50px -12px rgba(16, 185, 129, 0.25)',
              position: 'relative'
            }}
          >
            {/* Green Checkmark Badge */}
            <div 
              style={{
                width: '68px',
                height: '68px',
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '2px solid #10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.25rem auto'
              }}
            >
              <CheckCircle2 size={38} color="#10b981" />
            </div>

            <h2 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '0.75rem', color: '#f8fafc' }}>
              Bug Report Submitted
            </h2>

            <p style={{ color: '#cbd5e1', fontSize: '1rem', lineHeight: 1.5, marginBottom: '2rem' }}>
              The Master Admin has been notified and will update you when the fix has been implemented.
            </p>

            <button
              onClick={handleDismissSuccess}
              className="btn btn-primary btn-large"
              style={{
                background: '#10b981',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
                fontSize: '1.05rem',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </>
  );
}
