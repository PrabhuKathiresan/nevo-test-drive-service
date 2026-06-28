import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from '../App';

const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}T10:00`;

function renderApp() {
  render(<App vehicleType="tesla_model3" location="dublin" />);
}

async function fillAndSubmitForm() {
  const dateInput = screen.getByTestId('input-datetime');
  await userEvent.clear(dateInput);
  await userEvent.type(dateInput, tomorrowStr);
  await userEvent.type(screen.getByTestId('input-name'), 'Jane Doe');
  await userEvent.type(screen.getByTestId('input-email'), 'jane@doe.com');
  await userEvent.type(screen.getByTestId('input-phone'), '+353851234567');
  await userEvent.click(screen.getByTestId('btn-submit'));
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('App — validation', () => {
  it('shows validation errors when form is submitted empty', async () => {
    renderApp();
    // Clear the pre-filled date
    const dateInput = screen.getByTestId('input-datetime');
    await userEvent.clear(dateInput);
    await userEvent.click(screen.getByTestId('btn-submit'));
    expect(screen.getByText('Please select a date and time.')).toBeInTheDocument();
    expect(screen.getByText('Name is required.')).toBeInTheDocument();
    expect(screen.getByText('Email is required.')).toBeInTheDocument();
    expect(screen.getByText('Phone number is required.')).toBeInTheDocument();
  });

  it('clears a field error when the user starts typing', async () => {
    renderApp();
    await userEvent.click(screen.getByTestId('btn-submit'));
    expect(screen.getByText('Name is required.')).toBeInTheDocument();
    await userEvent.type(screen.getByTestId('input-name'), 'J');
    expect(screen.queryByText('Name is required.')).not.toBeInTheDocument();
  });
});

describe('App — availability flow', () => {
  it('shows confirm step when slot is available', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ available: true }),
    }));
    renderApp();
    await fillAndSubmitForm();
    await waitFor(() => expect(screen.getByTestId('btn-confirm')).toBeInTheDocument());
    expect(screen.getByText('Slot is available!')).toBeInTheDocument();
  });

  it('shows unavailable alert and keeps form when slot is not available', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ available: false }),
    }));
    renderApp();
    await fillAndSubmitForm();
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByText(/No availability/)).toBeInTheDocument();
    expect(screen.getByTestId('btn-submit')).toBeInTheDocument();
  });

  it('dismisses the unavailable alert when × is clicked', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ available: false }),
    }));
    renderApp();
    await fillAndSubmitForm();
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    await userEvent.click(screen.getByLabelText('Dismiss'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('App — booking flow', () => {
  it('shows success state after confirming a booking', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ available: true }) })
        .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ bookingId: 'abc-123' }) }),
    );
    renderApp();
    await fillAndSubmitForm();
    await waitFor(() => expect(screen.getByTestId('btn-confirm')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('btn-confirm'));
    await waitFor(() => expect(screen.getByTestId('booking-id')).toBeInTheDocument());
    expect(screen.getByTestId('booking-id')).toHaveTextContent('abc-123');
  });

  it('shows unavailable alert when booking returns 409', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ available: true }) })
        .mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({}) }),
    );
    renderApp();
    await fillAndSubmitForm();
    await waitFor(() => expect(screen.getByTestId('btn-confirm')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('btn-confirm'));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByTestId('btn-submit')).toBeInTheDocument();
  });

  it('resets to form when Book another is clicked', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ available: true }) })
        .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ bookingId: 'abc-123' }) }),
    );
    renderApp();
    await fillAndSubmitForm();
    await waitFor(() => screen.getByTestId('btn-confirm'));
    await userEvent.click(screen.getByTestId('btn-confirm'));
    await waitFor(() => screen.getByTestId('btn-book-another'));
    await userEvent.click(screen.getByTestId('btn-book-another'));
    expect(screen.getByTestId('btn-submit')).toBeInTheDocument();
  });
});
