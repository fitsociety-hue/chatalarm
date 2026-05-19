import { useState } from 'react';

export default function PinInput({ value, onChange, length = 4, idPrefix = 'pin' }) {
  const [isFocused, setIsFocused] = useState(false);

  const handleChange = (e) => {
    // Only allow numbers, up to the specified length
    const val = e.target.value.replace(/\D/g, '').slice(0, length);
    onChange(val);
  };

  return (
    <div className="pin-container" style={{ position: 'relative', width: '254px', margin: '6px auto 0' }}>
      {/* Real Invisible Input */}
      <input
        id={`${idPrefix}-real-input`}
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={length}
        value={value}
        onChange={handleChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          opacity: 0,
          zIndex: 2,
          cursor: 'pointer',
          border: 'none',
          outline: 'none',
        }}
      />
      {/* Visual Fake Input Boxes */}
      <div className="pin-fake-boxes" style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
        {Array.from({ length }).map((_, idx) => {
          const char = value[idx] || '';
          const active = isFocused && value.length === idx;
          return (
            <div
              key={idx}
              id={`${idPrefix}-box-${idx}`}
              className={`pin-fake-box ${char ? 'has-value' : ''} ${active ? 'focused' : ''}`}
              style={{
                width: '56px',
                height: '56px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                fontWeight: '700',
                background: 'rgba(255, 255, 255, 0.65)',
                border: active ? '1.5px solid var(--blue-500)' : '1.5px solid rgba(148, 163, 184, 0.4)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                boxShadow: active ? '0 0 0 3px rgba(59, 130, 246, 0.18)' : 'none',
                transition: 'border-color var(--transition), box-shadow var(--transition)',
              }}
            >
              {char ? '●' : ''}
            </div>
          );
        })}
      </div>
    </div>
  );
}
