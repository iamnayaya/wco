'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from '../../../lib/hooks/use-toast';
import { Button, Input, Field, Textarea } from '../../../components/ui';
import { Section, Toggle } from '../primitives';
import { businessProfileSchema, CURRENCIES, DATE_FORMATS, DEFAULT_BUSINESS, TIMEZONES } from '../helpers';

type SocialForm = { instagram: string; facebook: string; tiktok: string; website: string; phone: string; email: string; address: string };

export function BusinessTab() {
  const [active, setActive] = useState(true);
  const { register, handleSubmit, formState: { errors } } = useForm<typeof DEFAULT_BUSINESS>({
    resolver: zodResolver(businessProfileSchema),
    defaultValues: DEFAULT_BUSINESS,
  });
  const social = useForm<SocialForm>({
    defaultValues: {
      instagram: '',
      facebook: '',
      tiktok: '',
      website: '',
      phone: DEFAULT_BUSINESS.phone,
      email: DEFAULT_BUSINESS.email,
      address: DEFAULT_BUSINESS.address,
    },
  });

  function save() {
    toast.success('Business profile saved');
  }

  return (
    <div className="space-y-6">
      <Section title="Business details" description="Public information shown to your customers.">
        <form id="business-form" onSubmit={handleSubmit(save)} className="grid gap-4 sm:grid-cols-2">
          <Field label="Business name" error={errors.businessName?.message}><Input {...register('businessName')} /></Field>
          <Field label="Default currency" error={errors.currency?.message}>
            <select {...register('currency')} className="input">
              {CURRENCIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Timezone" error={errors.timezone?.message}>
            <select {...register('timezone')} className="input">
              {TIMEZONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="Date format" error={errors.dateFormat?.message}>
            <select {...register('dateFormat')} className="input">
              {DATE_FORMATS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description" error={errors.description?.message}><Textarea rows={3} {...register('description')} /></Field>
          </div>
          <div className="sm:col-span-2 flex justify-end"><Button type="submit">Save business details</Button></div>
        </form>
      </Section>

      <Section title="Contact information">
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={social.handleSubmit(() => toast.success('Contact info saved'))}>
          <Field label="Phone"><Input {...social.register('phone')} /></Field>
          <Field label="Email"><Input {...social.register('email')} type="email" /></Field>
          <div className="sm:col-span-2"><Field label="Address"><Input {...social.register('address')} /></Field></div>
          <div className="sm:col-span-2 flex justify-end"><Button type="submit">Save contact info</Button></div>
        </form>
      </Section>

      <Section title="Social links & website">
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={social.handleSubmit(() => toast.success('Social links saved'))}>
          <Field label="Instagram"><Input {...social.register('instagram')} placeholder="https://instagram.com/..." /></Field>
          <Field label="Facebook"><Input {...social.register('facebook')} placeholder="https://facebook.com/..." /></Field>
          <Field label="TikTok"><Input {...social.register('tiktok')} placeholder="https://tiktok.com/..." /></Field>
          <Field label="Website"><Input {...social.register('website')} placeholder="https://yourstore.com" /></Field>
          <div className="sm:col-span-2 flex justify-end"><Button type="submit">Save social links</Button></div>
        </form>
      </Section>

      <Section title="Store status" description="Controls whether your storefront is live.">
        <Toggle label="Store is active" description="Customers can place orders when this is on." checked={active} onChange={setActive} />
      </Section>
    </div>
  );
}
