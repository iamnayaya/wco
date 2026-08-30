import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { DatePicker } from '../form/DatePicker';
import { TimePicker } from '../form/TimePicker';
import { DateTimePicker } from '../form/DateTimePicker';
import { FileUpload } from '../form/FileUpload';
import { FilePreview } from '../form/FilePreview';
import { ColorPicker } from '../form/ColorPicker';
import { FormSection } from '../form/FormSection';

function dayCells(container: HTMLElement): HTMLElement[] {
  const grid = container.querySelector('[role="group"]');
  if (!grid) return [];
  return Array.from(grid.querySelectorAll<HTMLButtonElement>('button[aria-label]')).filter(
    (b) => b.getAttribute('aria-disabled') !== 'true',
  );
}

describe('DatePicker', () => {
  it('opens a calendar popover and commits a selection', () => {
    const onChange = vi.fn();
    const { container } = render(<DatePicker label="Ship date" onChange={onChange} locale="en-US" />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    const cells = dayCells(container);
    expect(cells.length).toBeGreaterThanOrEqual(28);
    fireEvent.click(cells[15]);
    expect(onChange).toHaveBeenCalledOnce();
    const [date] = onChange.mock.calls[0];
    expect(date).toBeInstanceOf(Date);
  });

  it('marks the selected day with aria-pressed', () => {
    const selected = new Date(2026, 7, 15);
    const { container } = render(<DatePicker label="Ship date" defaultValue={selected} locale="en-US" />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    const grid = container.querySelector('[role="group"]');
    expect(within(grid as HTMLElement).getByRole('button', { name: /August 15, 2026/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('navigates months with the prev/next controls', () => {
    const { container } = render(<DatePicker label="Ship date" locale="en-US" />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    const before = container.querySelector('[role="group"]')?.getAttribute('aria-label') ?? '';
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    const after = container.querySelector('[role="group"]')?.getAttribute('aria-label') ?? '';
    expect(after).not.toBe(before);
  });
});

describe('TimePicker', () => {
  it('exposes labelled hour/minute columns and commits', () => {
    const onChange = vi.fn();
    render(<TimePicker label="Open time" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('listbox', { name: 'Hours' })).toBeInTheDocument();
    expect(screen.getByRole('listbox', { name: 'Minutes' })).toBeInTheDocument();
    const hour = screen.getByRole('option', { name: '09 AM' });
    fireEvent.click(hour);
    expect(onChange).toHaveBeenCalled();
    const [date] = onChange.mock.lastCall as [Date];
    expect(date.getHours()).toBe(9);
  });
});

describe('DateTimePicker', () => {
  it('commits a combined instant on Done', () => {
    const onChange = vi.fn();
    const { container } = render(<DateTimePicker label="Appointment" onChange={onChange} locale="en-US" />);
    fireEvent.click(screen.getByLabelText('Appointment'));
    const cells = dayCells(container);
    fireEvent.click(cells[15]);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onChange).toHaveBeenCalledOnce();
    const [date] = onChange.mock.calls[0];
    expect(date).toBeInstanceOf(Date);
  });

  it('cancels without emitting', () => {
    const onChange = vi.fn();
    render(<DateTimePicker label="Appointment" onChange={onChange} locale="en-US" />);
    fireEvent.click(screen.getByLabelText('Appointment'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('FileUpload', () => {
  it('accepts files through the dropzone input', async () => {
    const onFiles = vi.fn();
    const { container } = render(<FileUpload label="Documents" onFiles={onFiles} accept=".txt" />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['hello'], 'note.txt', { type: 'text/plain' });
    await userEvent.upload(input, file);
    expect(onFiles).toHaveBeenCalledWith([file]);
  });

  it('rejects oversized files via onError', async () => {
    const onError = vi.fn();
    const { container } = render(<FileUpload label="Documents" onError={onError} maxSize={10} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const big = new File([new ArrayBuffer(100)], 'big.bin', { type: 'application/octet-stream' });
    await userEvent.upload(input, big);
    expect(onError).toHaveBeenCalled();
    const [errors] = onError.mock.calls[0];
    expect(errors[0].code).toBe('size');
  });
});

describe('FilePreview', () => {
  it('renders the file name and offers removal', () => {
    const onRemove = vi.fn();
    render(<FilePreview file={{ name: 'invoice.pdf', size: 2_000_000 }} onRemove={onRemove} />);
    expect(screen.getByText('invoice.pdf')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Remove/ }));
    expect(onRemove).toHaveBeenCalledOnce();
  });
});

describe('ColorPicker', () => {
  it('swatches are toggle buttons and call onChange', () => {
    const onChange = vi.fn();
    render(
      <ColorPicker
        label="Brand color"
        value="#2563eb"
        presets={['#2563eb', '#059669', '#d97706']}
        onChange={onChange}
      />,
    );
    expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: '#059669' }));
    expect(onChange).toHaveBeenCalledWith('#059669');
  });

  it('commits custom hex on Enter', () => {
    const onChange = vi.fn();
    render(<ColorPicker label="Brand color" value="#2563eb" onChange={onChange} />);
    const input = screen.getByLabelText('Brand color hex');
    fireEvent.change(input, { target: { value: 'bada55' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('#bada55');
  });
});

describe('FormSection', () => {
  it('renders a labelled section with heading', () => {
    render(
      <FormSection title="Delivery" description="Where should we send it?">
        <p>Content</p>
      </FormSection>,
    );
    expect(screen.getByRole('heading', { name: 'Delivery' })).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('collapses and expands', () => {
    render(
      <FormSection title="Billing" collapsible>
        <p>Hidden content</p>
      </FormSection>,
    );
    const toggle = screen.getByRole('button', { name: /Billing/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Hidden content')).not.toBeInTheDocument();
  });
});