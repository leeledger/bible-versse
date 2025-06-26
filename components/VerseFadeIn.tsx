import React, { useEffect, useState } from 'react';
import './VerseFadeIn.css';

interface VerseFadeInProps {
  verseText: string;
  className?: string;
}

const VerseFadeIn: React.FC<VerseFadeInProps> = ({ verseText, className }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(false);
    const timeout = setTimeout(() => setVisible(true), 400); // 더 긴 딜레이 후 페이드 인
    return () => clearTimeout(timeout);
  }, [verseText]);

  return (
    <div className={`fade-in-verse${visible ? ' visible' : ''} ${className || ''}`}>
      {verseText}
    </div>
  );
};

export default VerseFadeIn;
