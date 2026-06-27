import React from 'react';

interface Props {
  bookingId: string;
  onReset: () => void;
}

export default function BookingSuccess({ bookingId, onReset }: Props) {
  return (
    <div>
      <p style={styles.successMsg}>Booking confirmed!</p>
      <p style={styles.detail}>Booking ID: <code data-testid="booking-id">{bookingId}</code></p>
      <button style={styles.btn} onClick={onReset} data-testid="btn-book-another">
        Book another
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  successMsg: { color: '#2e7d32', fontWeight: 600, marginBottom: 8 },
  detail: { color: '#444', margin: '4px 0' },
  btn: { marginTop: 8, padding: '0.65rem 1.25rem', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.95rem', cursor: 'pointer', width: '100%' },
};
