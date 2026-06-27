import React from 'react';

interface Props {
  vehicleId: string;
  startDateTime: string;
  durationMins: number;
  isBooking: boolean;
  onConfirm: () => void;
  onBack: () => void;
}

export default function BookingConfirm({ vehicleId, startDateTime, durationMins, isBooking, onConfirm, onBack }: Props) {
  return (
    <div>
      <p style={styles.successMsg}>Slot is available!</p>
      <p style={styles.detail}>Vehicle: <strong>{vehicleId}</strong></p>
      <p style={styles.detail}>{new Date(startDateTime).toLocaleString()} · {durationMins} mins</p>
      <button style={styles.btn} onClick={onConfirm} disabled={isBooking} data-testid="btn-confirm">
        {isBooking ? 'Confirming…' : 'Confirm Booking'}
      </button>
      <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={onBack} disabled={isBooking} data-testid="btn-back">
        Back
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  successMsg: { color: '#2e7d32', fontWeight: 600, marginBottom: 8 },
  detail: { color: '#444', margin: '4px 0' },
  btn: { marginTop: 8, padding: '0.65rem 1.25rem', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.95rem', cursor: 'pointer', width: '100%' },
  btnSecondary: { background: '#eee', color: '#333' },
};
