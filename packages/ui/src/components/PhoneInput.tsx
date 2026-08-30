import { forwardRef, type CSSProperties, type InputHTMLAttributes } from 'react';
import { cn } from '../lib/cn';
import { controlSize, sem, type ControlSize } from '../lib/styles';
import { phoneMetadata, formatPhone, stripNonDigits } from '../lib/format';

/**
 * PhoneInput — a phone input with a country (dial-code) selector, live
 * formatting, and validation. Emerging markets first (NG/GH/KE/ZA).
 */
export interface PhoneInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'value' | 'onChange'> {
  size?: ControlSize;
  error?: boolean;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Two-letter country code; controls the dial-code prefix + formatting. */
  country?: string;
  onCountryChange?: (country: string) => void;
  countries?: string[];
  className?: string;
  style?: CSSProperties;
}

const FLAG: Record<string, string> = {
  NG: '🇳🇬', GH: '🇬🇭', KE: '🇰🇪', ZA: '🇿🇦', US: '🇺🇸', GB: '🇬🇧', FR: '🇫🇷', IN: '🇮🇳',
};

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(function PhoneInput(
  {
    size = 'md',
    error = false,
    value,
    defaultValue = '',
    onChange,
    country = 'NG',
    onCountryChange,
    countries = ['NG', 'GH', 'KE', 'ZA', 'US', 'GB'],
    className,
    style,
    disabled,
    'aria-invalid': ariaInvalid,
    ...props
  },
  ref,
) {
  const s = controlSize[size];
  const invalid = error || ariaInvalid === true;
  const dial = phoneMetadata[country]?.dialCode ?? '+000';

  return (
    <div className={cn('wco-phone', className)} style={{ display: 'flex', gap: 8, width: '100%' }}>
      <span style={{ position: 'relative', flexShrink: 0 }}>
        <select
          aria-label="Country code"
          disabled={disabled}
          value={country}
          onChange={(e) => onCountryChange?.(e.target.value)}
          style={{
            height: s.height,
            paddingInlineEnd: 6,
            paddingLeft: 4,
            border: `1px solid ${invalid ? sem('dangerText') : sem('borderStrong')}`,
            borderRadius: 10,
            background: sem('surface'),
            color: sem('text'),
            fontSize: s.fontSize,
            cursor: 'pointer',
            appearance: 'none',
          }}
        >
          {countries.map((c) => (
            <option key={c} value={c}>
              {FLAG[c] ?? ''} {phoneMetadata[c]?.dialCode ?? '+0'}
            </option>
          ))}
        </select>
      </span>
      <input
        ref={ref}
        type="tel"
        inputMode="tel"
        disabled={disabled}
        value={value ?? formatPhone(defaultValue, country).trim()}
        onChange={(e) => {
          const digits = stripNonDigits(e.target.value);
          const formatted = formatPhone(digits, country).trim();
          if (formatted.startsWith(dial)) {
            onChange?.(formatted);
          } else {
            onChange?.(`${dial} ${digits}`.trim());
          }
        }}
        placeholder={`${dial} 000 000 0000`}
        aria-invalid={invalid || undefined}
        style={{
          width: '100%',
          minHeight: s.height,
          paddingInline: s.px,
          fontSize: s.fontSize,
          fontFamily: 'var(--font-inter, system-ui)',
          color: sem('text'),
          background: sem('surface'),
          border: `1px solid ${invalid ? sem('dangerText') : sem('borderStrong')}`,
          borderRadius: 10,
          boxShadow: invalid ? `0 0 0 3px ${sem('dangerBg')}` : undefined,
          outline: 'none',
          transition: 'border-color 120ms ease',
          ...style,
        }}
        {...props}
      />
    </div>
  );
});
