import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import BookingConfirm from '../components/BookingConfirm';

const BASE_PROPS = {
  startDateTime: '2025-06-30T10:00',
  durationMins: 45,
  isBooking: false,
  onConfirm: vi.fn(),
  onBack: vi.fn(),
};

describe('BookingConfirm — rendering', () => {
  it('shows available message and slot details', () => {
    render(<BookingConfirm {...BASE_PROPS} />);
    expect(screen.getByText('Slot is available!')).toBeInTheDocument();
    expect(screen.getByText(/45 mins/)).toBeInTheDocument();
  });

  it('does not expose vehicle id to the user', () => {
    render(<BookingConfirm {...BASE_PROPS} />);
    expect(screen.queryByText(/vehicle/i)).not.toBeInTheDocument();
  });

  it('shows confirm and back buttons in idle state', () => {
    render(<BookingConfirm {...BASE_PROPS} />);
    expect(screen.getByTestId('btn-confirm')).toHaveTextContent('Confirm Booking');
    expect(screen.getByTestId('btn-back')).toBeInTheDocument();
  });
});

describe('BookingConfirm — booking in progress', () => {
  it('disables both buttons and shows confirming text while booking', () => {
    render(<BookingConfirm {...BASE_PROPS} isBooking={true} />);
    expect(screen.getByTestId('btn-confirm')).toBeDisabled();
    expect(screen.getByTestId('btn-confirm')).toHaveTextContent('Confirming…');
    expect(screen.getByTestId('btn-back')).toBeDisabled();
  });
});

describe('BookingConfirm — interactions', () => {
  it('calls onConfirm when confirm button is clicked', async () => {
    const onConfirm = vi.fn();
    render(<BookingConfirm {...BASE_PROPS} onConfirm={onConfirm} />);
    await userEvent.click(screen.getByTestId('btn-confirm'));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onBack when back button is clicked', async () => {
    const onBack = vi.fn();
    render(<BookingConfirm {...BASE_PROPS} onBack={onBack} />);
    await userEvent.click(screen.getByTestId('btn-back'));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
