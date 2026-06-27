import React from 'react';

export interface FormFields {
  startDateTime: string;
  durationMins: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}

export interface FieldErrors {
  startDateTime?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
}

interface Props {
  fields: FormFields;
  errors: FieldErrors;
  isChecking: boolean;
  minDate: string;
  maxDate: string;
  onChange: (updated: Partial<FormFields>) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function BookingForm({ fields, errors, isChecking, minDate, maxDate, onChange, onSubmit }: Props) {
  return (
    <form onSubmit={onSubmit} style={styles.form} noValidate>
      <div style={styles.field}>
        <label style={styles.label}>
          Date &amp; Time
          <input
            style={{ ...styles.input, ...(errors.startDateTime ? styles.inputError : {}) }}
            type="datetime-local"
            min={minDate}
            max={maxDate}
            value={fields.startDateTime}
            onChange={(e) => onChange({ startDateTime: e.target.value })}
            data-testid="input-datetime"
          />
        </label>
        {errors.startDateTime && <span style={styles.fieldError} role="alert">{errors.startDateTime}</span>}
      </div>

      <label style={styles.label}>
        Duration (minutes)
        <select
          style={styles.input}
          value={fields.durationMins}
          onChange={(e) => onChange({ durationMins: Number(e.target.value) })}
          data-testid="input-duration"
        >
          <option value={30}>30</option>
          <option value={45}>45</option>
          <option value={60}>60</option>
        </select>
      </label>

      <div style={styles.field}>
        <label style={styles.label}>
          Your Name
          <input
            style={{ ...styles.input, ...(errors.customerName ? styles.inputError : {}) }}
            type="text"
            value={fields.customerName}
            onChange={(e) => onChange({ customerName: e.target.value })}
            data-testid="input-name"
          />
        </label>
        {errors.customerName && <span style={styles.fieldError} role="alert">{errors.customerName}</span>}
      </div>

      <div style={styles.field}>
        <label style={styles.label}>
          Email
          <input
            style={{ ...styles.input, ...(errors.customerEmail ? styles.inputError : {}) }}
            type="email"
            value={fields.customerEmail}
            onChange={(e) => onChange({ customerEmail: e.target.value })}
            data-testid="input-email"
          />
        </label>
        {errors.customerEmail && <span style={styles.fieldError} role="alert">{errors.customerEmail}</span>}
      </div>

      <div style={styles.field}>
        <label style={styles.label}>
          Phone
          <input
            style={{ ...styles.input, ...(errors.customerPhone ? styles.inputError : {}) }}
            type="tel"
            value={fields.customerPhone}
            onChange={(e) => onChange({ customerPhone: e.target.value })}
            data-testid="input-phone"
          />
        </label>
        {errors.customerPhone && <span style={styles.fieldError} role="alert">{errors.customerPhone}</span>}
      </div>

      <button style={styles.btn} type="submit" disabled={isChecking} data-testid="btn-submit">
        {isChecking ? 'Checking…' : 'Check Availability'}
      </button>
    </form>
  );
}

const styles: Record<string, React.CSSProperties> = {
  form: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  field: { display: 'flex', flexDirection: 'column', gap: 2 },
  label: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.875rem', fontWeight: 500, color: '#333' },
  input: { padding: '0.5rem 0.75rem', border: '1px solid #ddd', borderRadius: 6, fontSize: '0.95rem', marginTop: 2 },
  inputError: { border: '1px solid #c62828' },
  fieldError: { color: '#c62828', fontSize: '0.78rem', marginTop: 2 },
  btn: { marginTop: 8, padding: '0.65rem 1.25rem', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.95rem', cursor: 'pointer', width: '100%' },
};
