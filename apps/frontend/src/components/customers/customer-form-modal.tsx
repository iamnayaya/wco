'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Field, Input, Textarea } from '../../components/ui';
import { Modal } from '../../components/ui/modal';
import { useCreateCustomer, useCustomerDetail, useUpdateCustomer } from './hooks';

const customerFormSchema = z.object({
  waPhone: z
    .string()
    .min(7, 'Enter a valid phone number')
    .max(20, 'Phone number is too long'),
  name: z.string().max(120).optional().or(z.literal('')),
  email: z.string().email('Enter a valid email').max(254).optional().or(z.literal('')),
  tags: z.array(z.string()).max(20),
  marketingOptIn: z.boolean(),
  notes: z.string().max(5000).optional(),
});

type CustomerFormValues = z.infer<typeof customerFormSchema>;

interface CustomerFormModalProps {
  customerId?: string;
  onClose: () => void;
  onDone: () => void;
}

/**
 * Create + Edit customer. When `customerId` is provided the form seeds from the
 * existing record and PATCHes; otherwise it POSTs a new WhatsApp-first record
 * where `waPhone` is the identity key.
 */
export function CustomerFormModal({ customerId, onClose, onDone }: CustomerFormModalProps) {
  const isEdit = Boolean(customerId);
  const detail = useCustomerDetail(customerId ?? null);
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();

  const pending = detail.isLoading || createCustomer.isPending || updateCustomer.isPending;
  const error =
    detail.error instanceof Error ? detail.error.message : (createCustomer.error || updateCustomer.error) instanceof Error
      ? ((createCustomer.error || updateCustomer.error) as Error).message
      : null;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: { waPhone: '', name: '', email: '', tags: [], marketingOptIn: false, notes: '' },
  });

  useEffect(() => {
    if (customerId && detail.data) {
      reset({
        waPhone: detail.data.waPhone,
        name: detail.data.name ?? '',
        email: detail.data.email ?? '',
        tags: detail.data.tags,
        marketingOptIn: detail.data.marketingOptIn,
        notes: detail.data.notes ?? '',
      });
    }
  }, [customerId, detail.data, reset]);

  const tags = watch('tags');

  function addTag(raw: string) {
    const name = raw.trim();
    if (!name || tags.includes(name) || tags.length >= 20) return;
    setValue('tags', [...tags, name]);
  }

  function removeTag(name: string) {
    setValue('tags', tags.filter((t) => t !== name));
  }

  function onSubmit(values: CustomerFormValues) {
    const payload = {
      name: values.name?.trim() || undefined,
      email: values.email?.trim() || undefined,
      tags: values.tags,
      marketingOptIn: values.marketingOptIn,
      notes: values.notes?.trim() || undefined,
    };
    if (isEdit && customerId) {
      updateCustomer.mutate({ id: customerId, input: payload }, { onSuccess: () => onDone() });
    } else {
      createCustomer.mutate({ ...payload, waPhone: values.waPhone.trim() }, { onSuccess: () => onDone() });
    }
  }

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit customer' : 'Create customer'} size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {isEdit && detail.isLoading ? (
          <p className="text-sm text-slate-500">Loading customer…</p>
        ) : (
          <>
            <Field label="Phone (identity)" error={errors.waPhone?.message}>
              <Input
                {...register('waPhone')}
                disabled={isEdit}
                placeholder="+234…"
                aria-invalid={Boolean(errors.waPhone)}
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name" error={errors.name?.message}>
                <Input {...register('name')} placeholder="Customer name" aria-invalid={Boolean(errors.name)} />
              </Field>
              <Field label="Email" error={errors.email?.message}>
                <Input
                  {...register('email')}
                  type="email"
                  placeholder="customer@example.com"
                  aria-invalid={Boolean(errors.email)}
                />
              </Field>
            </div>

            <Field label="Tags">
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-1">
                  {tags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20 hover:bg-red-50 hover:text-red-700"
                    >
                      {tag} ✕
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    className="flex-1"
                    placeholder="Type a tag and press Enter"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag((e.target as HTMLInputElement).value);
                        (e.target as HTMLInputElement).value = '';
                      }
                    }}
                    aria-label="Add a tag"
                  />
                </div>
                <p className="text-xs text-slate-400">Press Enter to add a tag. Up to 20 tags.</p>
              </div>
            </Field>

            <Field label="Notes" error={errors.notes?.message}>
              <Textarea rows={3} {...register('notes')} placeholder="Internal notes about this customer" aria-invalid={Boolean(errors.notes)} />
            </Field>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" className="h-4 w-4 accent-emerald-600" {...register('marketingOptIn')} />
              Customer opted in to marketing messages
            </label>
          </>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={pending} disabled={isEdit && detail.isLoading}>
            {isEdit ? 'Save changes' : 'Create customer'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
