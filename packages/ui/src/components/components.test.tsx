import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TagInput } from './TagInput';
import { PasswordInput, estimatePasswordStrength } from './PasswordInput';
import { RatingInput } from './RatingInput';
import { OTPInput } from './OTPInput';

describe('TagInput', () => {
  it('renders the tag input with its accessible label', () => {
    render(<TagInput defaultValue={[]} aria-label="Tags" />);
    expect(screen.getByLabelText('Tags')).toBeInTheDocument();
  });

  it('adds a tag on Enter', () => {
    render(<TagInput defaultValue={[]} />);
    const input = screen.getByLabelText('Tags') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'onion' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText('onion')).toBeInTheDocument();
  });

  it('does not add duplicate tags', () => {
    render(<TagInput defaultValue={['milk']} />);
    const input = screen.getByLabelText('Tags') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'milk' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getAllByText('milk')).toHaveLength(1);
  });

  it('removes a tag via its remove button', () => {
    render(<TagInput defaultValue={['milk', 'eggs']} />);
    fireEvent.click(screen.getByLabelText('Remove milk'));
    expect(screen.queryByText('milk')).not.toBeInTheDocument();
  });
});

describe('PasswordInput', () => {
  it('renders a masked password field', () => {
    const { container } = render(<PasswordInput aria-label="Password" />);
    const field = container.querySelector('input[type="password"]');
    expect(field).not.toBeNull();
    expect(field).toHaveAttribute('type', 'password');
  });

  it('has a show/hide toggle with aria-pressed', () => {
    render(<PasswordInput aria-label="Password" />);
    const btn = screen.getByLabelText('Show password');
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Hide password')).toBeInTheDocument();
  });
});

describe('estimatePasswordStrength', () => {
  it('scores weak passwords low', () => {
    expect(estimatePasswordStrength('short')).toBeLessThan(3);
  });

  it('scores strong passwords at max', () => {
    expect(estimatePasswordStrength('Str0ng-Passw0rd!')).toBe(4);
  });
});

describe('RatingInput', () => {
  it('renders a radiogroup', () => {
    render(<RatingInput defaultValue={3} />);
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
  });

  it('selects a value on click', () => {
    const onChange = vi.fn();
    render(<RatingInput defaultValue={0} onChange={onChange} max={5} />);
    fireEvent.click(screen.getByLabelText('3 of 5'));
    expect(onChange).toHaveBeenCalledWith(3);
  });
});

describe('OTPInput', () => {
  it('renders the requested number of digit boxes', () => {
    render(<OTPInput length={4} />);
    expect(screen.getAllByRole('textbox')).toHaveLength(4);
  });

  it('fires onComplete when the full code is entered', () => {
    const onComplete = vi.fn();
    render(<OTPInput length={4} onComplete={onComplete} />);
    const boxes = screen.getAllByRole('textbox') as HTMLInputElement[];
    boxes.forEach((b) => fireEvent.change(b, { target: { value: '1' } }));
    expect(onComplete).toHaveBeenCalledWith('1111');
  });
});
