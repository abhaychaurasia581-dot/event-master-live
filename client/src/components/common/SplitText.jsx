import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';

const SplitText = ({
  text = '',
  className = '',
  delay = 50,
  duration = 1.25,
  ease = 'power3.out',
  splitType = 'chars',
  from = { opacity: 0, y: 40 },
  to = { opacity: 1, y: 0 },
  threshold = 0.1,
  rootMargin = '-100px',
  textAlign = 'center',
  onLetterAnimationComplete,
  showCallback = false
}) => {
  const containerRef = useRef(null);
  
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Get all the split elements
    const elements = container.querySelectorAll('.split-item');

    // Create intersection observer to trigger animation
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Animate using GSAP stagger
            gsap.fromTo(
              elements,
              from,
              {
                ...to,
                duration: duration,
                ease: ease,
                stagger: delay / 1000,
                onComplete: () => {
                  if (showCallback && onLetterAnimationComplete) {
                    onLetterAnimationComplete();
                  }
                }
              }
            );
            // Only trigger once
            observer.unobserve(container);
          }
        });
      },
      { threshold, rootMargin }
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [delay, duration, ease, from, to, threshold, rootMargin, onLetterAnimationComplete, showCallback]);

  const words = (typeof text === 'string' ? text : '').split(' ');

  return (
    <div ref={containerRef} className={`${className}`} style={{ textAlign, display: 'inline-block' }}>
      {words.map((word, wordIndex) => (
        <span key={wordIndex} className="inline-block whitespace-nowrap" style={{ marginRight: '0.25em' }}>
          {splitType === 'chars' ? (
            word.split('').map((char, charIndex) => (
              <span 
                key={charIndex} 
                className="split-item inline-block"
                style={{ opacity: from.opacity, transform: `translateY(${from.y}px)` }}
              >
                {char}
              </span>
            ))
          ) : (
            <span 
              className="split-item inline-block"
              style={{ opacity: from.opacity, transform: `translateY(${from.y}px)` }}
            >
              {word}
            </span>
          )}
        </span>
      ))}
    </div>
  );
};

export default SplitText;
