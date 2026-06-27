import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import BookingForm, { FieldErrors, FormFields } from '../components/BookingForm';

const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}T10:00`;

const defaultFields: FormFields = {
  startDateTime: tomorrowStr,
  durationMins: 45,
  customerName: '',
  customerEmail: '',
  customerPhone: '',
};

function renderForm(overrides: { fields?: Partial<FormFields>; errors?: FieldErrors } = {}) {
  const onChange = vi.fn();
  const onSubmit = vi.fn((e) => e.preventDefault());
  render(
    <BookingForm
      fields={{ ...defaultFields, ...overrides.fields }}
      errors={overrides.errors ?? {}}
      isChecking={false}
      minDate="2020-01-01T00:00"
      maxDate="2099-12-31T23:59"
      onChange={onChange}
      onSubmit={onSubmit}
    />,
  );
  return { onChange, onSubmit };
}

describe('BookingForm — field rendering', () => {
  it('renders all form fields', () => {
    renderForm();
    expect(screen.getByTestId('input-datetime')).toBeInTheDocument();
    expect(screen.getByTestId('input-duration')).toBeInTheDocument();
    expect(screen.getByTestId('input-name')).toBeInTheDocument();
    expect(screen.getByTestId('input-email')).toBeInTheDocument();
    expect(screen.getByTestId('input-phone')).toBeInTheDocument();
  });

  it('shows checking state on the submit button', () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();
    render(
      <BookingForm
        fields={defaultFields}
        errors={{}}
        isChecking={true}
        minDate="2020-01-01T00:00"
        maxDate="2099-12-31T23:59"
        onChange={onChange}
        onSubmit={onSubmit}
      />,
    );
    expect(screen.getByTestId('btn-submit')).toBeDisabled();
    expect(screen.getByTestId('btn-submit')).toHaveTextContent('Checking…');
  });
});

describe('BookingForm — validation errors', () => {
  it('displays field errors when provided', () => {
    renderForm({
      errors: {
        customerName: 'Name is required.',
        customerEmail: 'Please enter a valid email address.',
        customerPhone: 'Phone number is required.',
      },
    });
    expect(screen.getByText('Name is required.')).toBeInTheDocument();
    expect(screen.getByText('Please enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByText('Phone number is required.')).toBeInTheDocument();
  });

  it('calls onChange when a field is updated', async () => {
    const { onChange } = renderForm();
    await userEvent.type(screen.getByTestId('input-name'), 'A');
    expect(onChange).toHaveBeenCalledWith({ customerName: 'A' });
  });
});
