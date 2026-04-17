import React, { useState } from 'react';
import { Button } from '../shared/index.js';

interface SuccessModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  code: string;
  onClose: () => void;
}

export function SuccessModal({
  isOpen,
  title,
  message,
  code,
  onClose,
}: SuccessModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="w-80 text-center bg-slate-900 border border-slate-700 rounded-lg p-6">
        <div className="mb-6">
          <div className="w-16 h-16 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-600/30">
            <span className="text-3xl text-green-400">✓</span>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
          <p className="text-sm text-gray-400">{message}</p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 mb-6">
          <p className="text-xs text-gray-400 mb-2">Invitation Code</p>
          <p className="text-3xl font-mono font-bold text-orange-400 tracking-widest mb-3">
            {code}
          </p>
          <Button
            size="sm"
            variant={copied ? 'secondary' : 'primary'}
            onClick={handleCopyCode}
            className="w-full"
          >
            {copied ? '✓ Copied!' : 'Copy Code'}
          </Button>
        </div>

        <Button
          onClick={onClose}
          className="w-full"
        >
          Close
        </Button>
      </div>
    </div>
  );
}
