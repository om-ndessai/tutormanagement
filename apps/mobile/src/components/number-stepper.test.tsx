// NumberStepper (Phase 47, design 61): typed text commits clamped ("−3" and "-3" alike, junk keeps the
// value), − and + step and stop at the bounds, the labels are the web's, the formatted value shows
// until the field is focused, and the keyboard suits the platform and the range.
import { fireEvent, screen } from '@testing-library/react-native';
import { pointsLabel } from '@tmi/shared';
import { useState } from 'react';

import { renderWithProviders } from '@/test/render';
import { NumberStepper, stepperCommit, stepperKeyboard, stepperRange } from './number-stepper';

describe('stepperCommit', () => {
  it('clamps a typed number to the range', () => {
    expect(stepperCommit('99', 1, 50, 10)).toBe(50);
    expect(stepperCommit('0', 1, 50, 10)).toBe(1);
    expect(stepperCommit(' 12 ', 1, 50, 10)).toBe(12);
  });

  it('reads the minus sign either way', () => {
    expect(stepperCommit('−3', -10, 0, 0)).toBe(-3);
    expect(stepperCommit('-3', -10, 0, 0)).toBe(-3);
    expect(stepperCommit('-30', -10, 0, 0)).toBe(-10);
    expect(stepperCommit('+2', 1, 10, 1)).toBe(2);
  });

  it('keeps the value for empty or junk text', () => {
    expect(stepperCommit('', 1, 50, 10)).toBe(10);
    expect(stepperCommit('abc', 1, 50, 10)).toBe(10);
    expect(stepperCommit('−', -10, 0, -2)).toBe(-2);
  });
});

describe('the keyboard and the range', () => {
  it('gives iOS numbers and punctuation, Android the number pad, or the phone pad below zero', () => {
    expect(stepperKeyboard('ios', 1)).toBe('numbers-and-punctuation');
    expect(stepperKeyboard('ios', -10)).toBe('numbers-and-punctuation');
    expect(stepperKeyboard('android', 1)).toBe('number-pad');
    expect(stepperKeyboard('android', -10)).toBe('phone-pad');
  });

  it('says the range, through the format when there is one', () => {
    expect(stepperRange(1, 50)).toBe('1 to 50');
    expect(stepperRange(-10, 0, pointsLabel)).toBe('−10 to 0');
  });
});

function Harness({
  start = 2,
  min = 1,
  max = 3,
  format,
}: {
  start?: number;
  min?: number;
  max?: number;
  format?: (n: number) => string;
}) {
  const [value, setValue] = useState(start);
  return (
    <NumberStepper
      label="Questions"
      value={value}
      min={min}
      max={max}
      onChange={setValue}
      format={format}
      testID="amount"
    />
  );
}

describe('NumberStepper', () => {
  it('steps with − and +, and stops at the bounds', async () => {
    await renderWithProviders(<Harness />);
    expect(screen.getByTestId('amount').props.value).toBe('2');
    await fireEvent.press(screen.getByTestId('amount-plus'));
    expect(screen.getByTestId('amount').props.value).toBe('3');
    expect(screen.getByTestId('amount-plus')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('amount-minus'));
    await fireEvent.press(screen.getByTestId('amount-minus'));
    expect(screen.getByTestId('amount').props.value).toBe('1');
    expect(screen.getByTestId('amount-minus')).toBeDisabled();
  });

  it("labels its buttons the web's way and shows the range", async () => {
    await renderWithProviders(<Harness />);
    expect(screen.getByLabelText('Questions: one less')).toBeTruthy();
    expect(screen.getByLabelText('Questions: one more')).toBeTruthy();
    expect(screen.getByText('1 to 3')).toBeTruthy();
  });

  it('shows the formatted value until focused, then the number; a typed one commits clamped', async () => {
    await renderWithProviders(<Harness start={-1} min={-10} max={0} format={pointsLabel} />);
    const field = screen.getByTestId('amount');
    expect(field.props.value).toBe('−1');
    await fireEvent(field, 'focus');
    expect(screen.getByTestId('amount').props.value).toBe('-1');
    await fireEvent.changeText(screen.getByTestId('amount'), '−30');
    await fireEvent(screen.getByTestId('amount'), 'blur');
    expect(screen.getByTestId('amount').props.value).toBe('−10');
    await fireEvent(screen.getByTestId('amount'), 'focus');
    await fireEvent.changeText(screen.getByTestId('amount'), 'junk');
    await fireEvent(screen.getByTestId('amount'), 'submitEditing');
    expect(screen.getByTestId('amount').props.value).toBe('−10');
  });
});
