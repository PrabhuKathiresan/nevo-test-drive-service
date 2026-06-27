import React from 'react';

interface Props {
  message: React.ReactNode;
  onDismiss: () => void;
}

export default function Alert({ message, onDismiss }: Props) {
  return (
    <div style={styles.alert} role="alert">
      <span>{message}</span>
      <button style={styles.close} onClick={onDismiss} aria-label="Dismiss">×</button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  alert: {
    position: 'relative',
    background: '#fff3f3',
    border: '1px solid #f5c6cb',
    color: '#c62828',
    borderRadius: 6,
    padding: '0.65rem 2.5rem 0.65rem 0.85rem',
    marginBottom: '1rem',
    fontSize: '0.875rem',
  },
  close: {
    position: 'absolute',
    top: '50%',
    right: '0.65rem',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    fontSize: '1.1rem',
    cursor: 'pointer',
    color: '#c62828',
    lineHeight: 1,
  },
};
