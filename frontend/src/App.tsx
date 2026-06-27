import React, { useState } from 'react';
import Alert from './components/Alert';
import BookingForm, { FieldErrors, FormFields } from './components/BookingForm';
import BookingConfirm from './components/BookingConfirm';
import BookingSuccess from './components/BookingSuccess';

function toLocalDateTimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultDateTime(): string {
  const now = new Date();
  now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15, 0, 0);
  return toLocalDateTimeInput(now);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[\d\s\-()]{7,15}$/;

function validate(fields: FormFields): FieldErrors {
  const errors: FieldErrors = {};
  const selected = new Date(fields.startDateTime);
  const now = new Date();
  const max = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  if (!fields.startDateTime) {
    errors.startDateTime = 'Please select a date and time.';
  } else if (selected <= now) {
    errors.startDateTime = 'Please select a future date and time.';
  } else if (selected > max) {
    errors.startDateTime = 'Bookings are available up to 14 days in advance.';
  }

  if (!fields.customerName.trim()) {
    errors.customerName = 'Name is required.';
  } else if (fields.customerName.trim().length < 2) {
    errors.customerName = 'Name must be at least 2 characters.';
  }

  if (!fields.customerEmail.trim()) {
    errors.customerEmail = 'Email is required.';
  } else if (!EMAIL_RE.test(fields.customerEmail)) {
    errors.customerEmail = 'Please enter a valid email address.';
  }

  if (!fields.customerPhone.trim()) {
    errors.customerPhone = 'Phone number is required.';
  } else if (!PHONE_RE.test(fields.customerPhone)) {
    errors.customerPhone = 'Please enter a valid phone number.';
  }

  return errors;
}

interface Props {
  vehicleType: string;
  location: string;
}

type Step = 'form' | 'checking' | 'confirm' | 'booking' | 'success' | 'error';

const API = '/api/v1';

export default function App({ vehicleType, location }: Props) {
  const [step, setStep] = useState<Step>('form');
  const [fields, setFields] = useState<FormFields>({
    startDateTime: defaultDateTime(),
    durationMins: 45,
    customerName: '',
    customerEmail: '',
    customerPhone: '',
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [unavailableAlert, setUnavailableAlert] = useState(false);
  const [vehicleId, setVehicleId] = useState('');
  const [bookingId, setBookingId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const minDate = toLocalDateTimeInput(new Date());
  const maxDate = toLocalDateTimeInput(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000));

  function handleChange(updated: Partial<FormFields>) {
    setFields((f) => ({ ...f, ...updated }));
    const key = Object.keys(updated)[0] as keyof FieldErrors;
    if (key) setFieldErrors((e) => ({ ...e, [key]: undefined }));
    setUnavailableAlert(false);
  }

  async function handleCheckAvailability(e: React.FormEvent) {
    e.preventDefault();
    const errors = validate(fields);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setUnavailableAlert(false);
    setStep('checking');
    try {
      const res = await fetch(`${API}/availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location,
          vehicleType,
          startDateTime: new Date(fields.startDateTime).toISOString(),
          durationMins: fields.durationMins,
        }),
      });
      const data = await res.json();
      if (data.available) {
        setVehicleId(data.vehicleId);
        setStep('confirm');
      } else {
        setUnavailableAlert(true);
        setStep('form');
      }
    } catch {
      setErrorMessage('Failed to check availability. Please try again.');
      setStep('error');
    }
  }

  async function handleConfirm() {
    setStep('booking');
    try {
      const res = await fetch(`${API}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleId,
          startDateTime: new Date(fields.startDateTime).toISOString(),
          durationMins: fields.durationMins,
          customerName: fields.customerName,
          customerEmail: fields.customerEmail,
          customerPhone: fields.customerPhone,
        }),
      });
      if (res.status === 409) {
        setUnavailableAlert(true);
        setStep('form');
        return;
      }
      if (!res.ok) throw new Error();
      const data = await res.json();
      setBookingId(data.bookingId);
      setStep('success');
    } catch {
      setErrorMessage('Failed to complete booking. Please try again.');
      setStep('error');
    }
  }

  function reset() {
    setStep('form');
    setFieldErrors({});
    setUnavailableAlert(false);
    setVehicleId('');
    setBookingId('');
    setErrorMessage('');
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Book a Test Drive</h1>
        <p style={styles.subtitle}>{vehicleType.replace(/_/g, ' ')} · {location}</p>

        {unavailableAlert && (
          <Alert
            message={<><strong>No availability</strong> for the selected slot. Please try a different time.</>}
            onDismiss={() => setUnavailableAlert(false)}
          />
        )}

        {(step === 'form' || step === 'checking') && (
          <BookingForm
            fields={fields}
            errors={fieldErrors}
            isChecking={step === 'checking'}
            minDate={minDate}
            maxDate={maxDate}
            onChange={handleChange}
            onSubmit={handleCheckAvailability}
          />
        )}

        {(step === 'confirm' || step === 'booking') && (
          <BookingConfirm
            vehicleId={vehicleId}
            startDateTime={fields.startDateTime}
            durationMins={fields.durationMins}
            isBooking={step === 'booking'}
            onConfirm={handleConfirm}
            onBack={reset}
          />
        )}

        {step === 'success' && (
          <BookingSuccess bookingId={bookingId} onReset={reset} />
        )}

        {step === 'error' && (
          <div>
            <p style={styles.errorMsg}>{errorMessage}</p>
            <button style={styles.btn} onClick={reset}>Try again</button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f6f8', fontFamily: 'system-ui, sans-serif' },
  card: { background: '#fff', borderRadius: 12, padding: '2rem', width: '100%', maxWidth: 420, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' },
  title: { margin: '0 0 4px', fontSize: '1.5rem', color: '#1a1a2e' },
  subtitle: { margin: '0 0 1.5rem', color: '#666', textTransform: 'capitalize' },
  btn: { marginTop: 8, padding: '0.65rem 1.25rem', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.95rem', cursor: 'pointer', width: '100%' },
  errorMsg: { color: '#c62828', fontWeight: 600, marginBottom: 8 },
};
